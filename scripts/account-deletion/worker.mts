import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { DeletionContext } from './environment.mts';
import { isMissingAuth, requireDeletionRules, validateUid } from './environment.mts';
import { inventory } from './inventory.mts';
import { cleanRoom, finishProfile } from './room-cleanup.mts';
import { blockPresence } from './presence.mts';

const leaseDuration = 5 * 60 * 1000;
const tokenWindow = 65 * 60 * 1000;
export type Confirmation = { uid: string; fingerprint: string };

/** Privileged operator tool, never imported into the browser or exposed as a public endpoint. */
export async function deleteAccount(
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
  const job = context.db.doc('accountDeletions/' + uid);
  const owner = randomUUID();
  const alreadyDone = await context.db.runTransaction(async (tx) => {
    const previous = await tx.get(job);
    if (previous.get('state') === 'complete') {
      if (
        plan.summary.accountExists ||
        plan.summary.profileExists ||
        plan.summary.directoryExists ||
        plan.rooms.length
      )
        throw new Error(
          'Nach Abschluss sind wieder Kontodaten vorhanden. Manuelle Prüfung erforderlich.',
        );
      return true;
    }
    if (!plan.summary.accountExists && !previous.exists)
      throw new Error('Konto existiert nicht; kein bestätigter Vorgang vorhanden.');
    if (previous.get('leaseUntil')?.toMillis() > Date.now())
      throw new Error('Löschung läuft bereits.');
    tx.set(job, {
      state: 'running',
      owner,
      leaseUntil: Timestamp.fromMillis(Date.now() + leaseDuration),
    });
    return false;
  });
  if (alreadyDone) return { state: 'complete', remaining: plan.summary };
  const heartbeat = async () => {
    await context.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(job);
      if (snapshot.get('owner') !== owner)
        throw new Error('Arbeitsauftrag gehört einem anderen Prozess.');
      tx.update(job, { leaseUntil: Timestamp.fromMillis(Date.now() + leaseDuration) });
    });
  };

  try {
    await blockPresence(context.presence, uid);
    try {
      await context.auth.updateUser(uid, { disabled: true });
      await context.auth.revokeRefreshTokens(uid);
    } catch (error) {
      if (!isMissingAuth(error)) throw error;
    }
    // Re-read after the deletion marker blocks stale tokens and new invitations.
    const lockedPlan = await inventory(context, uid);
    const references = new Map(lockedPlan.rooms.map((room) => [room.room.ref.id, room.room.ref]));
    const pending = await context.db.collection('deletionLocks').where('uid', '==', uid).get();
    for (const lock of pending.docs)
      if (lock.id !== lock.get('archiveId'))
        references.set(lock.id, context.db.doc('conversations/' + lock.id));
    for (const reference of references.values()) {
      await heartbeat();
      await cleanRoom(context.db, reference, uid, heartbeat);
    }
    await finishProfile(context.db, uid);
    const remaining = await inventory(context, uid);
    const locks = await context.db.collection('deletionLocks').where('uid', '==', uid).get();
    if (
      remaining.rooms.length ||
      remaining.summary.profileExists ||
      remaining.summary.directoryExists ||
      !locks.empty
    )
      throw new Error('Verknüpfte Daten verbleiben. Vorgang erneut aufnehmen.');
    await heartbeat();
    try {
      await context.auth.deleteUser(uid);
    } catch (error) {
      if (!isMissingAuth(error)) throw error;
    }
    try {
      await context.auth.getUser(uid);
      throw new Error('Auth-Konto verbleibt.');
    } catch (error) {
      if (!isMissingAuth(error)) throw error;
    }
    // Minimal guard for still-valid ID tokens; no email, name, content or retained migration map.
    await job.set({
      state: 'complete',
      purgeAfter: Timestamp.fromMillis(Date.now() + tokenWindow),
    });
    return { state: 'complete', remaining: { ...remaining.summary, accountExists: false } };
  } catch (error) {
    await context.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(job);
      if (snapshot.get('owner') === owner)
        tx.update(job, { state: 'failed', leaseUntil: Timestamp.fromMillis(0) });
    });
    throw error;
  }
}

/** Explicit maintenance: no automatic TTL or unverified backup expiry is claimed. */
export async function purgeCompleted(context: DeletionContext): Promise<number> {
  await requireDeletionRules(context);
  let removed = 0;
  const jobs = await context.db
    .collection('accountDeletions')
    .where('state', '==', 'complete')
    .get();
  for (const job of jobs.docs) {
    if (
      !(job.get('purgeAfter') instanceof Timestamp) ||
      job.get('purgeAfter').toMillis() > Date.now()
    )
      continue;
    try {
      await context.auth.getUser(job.id);
      continue;
    } catch (error) {
      if (!isMissingAuth(error)) throw error;
    }
    await context.presence?.ref('presenceBlocks/' + job.id).remove();
    await job.ref.delete();
    removed++;
  }
  return removed;
}
