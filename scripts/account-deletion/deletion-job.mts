import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { DeletionContext } from './environment.mts';
import { requireDeletionRules, validateUid } from './environment.mts';
import { inventory } from './inventory.mts';

const leaseDuration = 5 * 60 * 1000;
/** Operator acknowledgement tied to one UID and the fingerprint of its reviewed data inventory. */
export type Confirmation = { uid: string; fingerprint: string };
/** Lease identity and reviewed plan used by one privileged deletion attempt. */
export type DeletionJob = Awaited<ReturnType<typeof prepareJob>>;

/** Validates the explicit confirmation and deployed rules before acquiring a deletion lease. */
export async function prepareJob(
  context: DeletionContext,
  uid: string,
  confirmation: Confirmation,
) {
  validateUid(uid);
  if (confirmation.uid !== uid) throw new Error('Ausdrückliche Bestätigung dieser UID fehlt.');
  await requireDeletionRules(context);
  const plan = await inventory(context, uid);
  if (confirmation.fingerprint !== plan.fingerprint)
    throw new Error('Datenbestand geändert. Neue Vorschau prüfen und bestätigen.');
  return { ...jobIdentity(context, uid), plan };
}

/** Creates a process-specific lease identity without changing the reviewed account data. */
function jobIdentity(context: DeletionContext, uid: string) {
  return { context, uid, ref: context.db.doc('accountDeletions/' + uid), owner: randomUUID() };
}

/** Produces the running lease fields used by the atomic claim transaction. */
function runningLease(job: DeletionJob) {
  return {
    state: 'running',
    owner: job.owner,
    leaseUntil: Timestamp.fromMillis(Date.now() + leaseDuration),
  };
}

/** Refuses a completed job whose supposedly removed account data has reappeared. */
function verifyCompleted(job: DeletionJob): void {
  const summary = job.plan.summary;
  if (
    summary.accountExists ||
    summary.profileExists ||
    summary.directoryExists ||
    summary.proofExists ||
    job.plan.rooms.length
  )
    throw new Error(
      'Nach Abschluss sind wieder Kontodaten vorhanden. Manuelle Prüfung erforderlich.',
    );
}

/** Rejects a missing account without a resumable job or an unexpired competing lease. */
function verifyLease(job: DeletionJob, previous: DocumentSnapshot): void {
  if (!job.plan.summary.accountExists && !previous.exists)
    throw new Error('Konto existiert nicht; kein bestätigter Vorgang vorhanden.');
  if (previous.get('leaseUntil')?.toMillis() > Date.now())
    throw new Error('Löschung läuft bereits.');
}

/** Atomically claims the target UID or reports an already verified completed deletion. */
export async function claimJob(job: DeletionJob): Promise<boolean> {
  return job.context.db.runTransaction(async (tx) => {
    const previous = await tx.get(job.ref);
    if (previous.get('state') === 'complete') {
      verifyCompleted(job);
      return true;
    }
    verifyLease(job, previous);
    tx.set(job.ref, runningLease(job));
    return false;
  });
}

/** Extends the worker lease only while this process still owns the deletion job. */
export async function renewLease(job: DeletionJob): Promise<void> {
  await job.context.db.runTransaction(async (tx) => {
    const snapshot = await tx.get(job.ref);
    if (snapshot.get('owner') !== job.owner)
      throw new Error('Arbeitsauftrag gehört einem anderen Prozess.');
    tx.update(job.ref, { leaseUntil: Timestamp.fromMillis(Date.now() + leaseDuration) });
  });
}

/** Makes an interrupted attempt resumable without modifying another process's lease. */
export async function failJob(job: DeletionJob): Promise<void> {
  await job.context.db.runTransaction(async (tx) => {
    const snapshot = await tx.get(job.ref);
    if (snapshot.get('owner') === job.owner)
      tx.update(job.ref, { state: 'failed', leaseUntil: Timestamp.fromMillis(0) });
  });
}
