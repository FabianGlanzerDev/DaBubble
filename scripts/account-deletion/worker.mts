import { Timestamp } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { DeletionContext } from './environment.mts';
import { isMissingAuth, requireDeletionRules } from './environment.mts';
import { prepareJob, claimJob, renewLease, failJob } from './deletion-job.mts';
import type { Confirmation, DeletionJob } from './deletion-job.mts';
import { cleanAccount, removeAuth } from './account-cleanup.mts';
export type { Confirmation } from './deletion-job.mts';

const tokenWindow = 65 * 60 * 1000;

/** Finishes only after verified cleanup; minimal token guards contain no name, email or transcript. */
async function completeJob(job: DeletionJob) {
  const remaining = await cleanAccount(job);
  await renewLease(job);
  await removeAuth(job.context, job.uid);
  await job.ref.set({
    state: 'complete',
    purgeAfter: Timestamp.fromMillis(Date.now() + tokenWindow),
  });
  return { state: 'complete', remaining: { ...remaining, accountExists: false } };
}

/** Executes a fingerprint-confirmed cleanup; this privileged operator tool is never imported by the browser. */
export async function deleteAccount(
  context: DeletionContext,
  uid: string,
  confirmation: Confirmation,
) {
  const job = await prepareJob(context, uid, confirmation);
  if (await claimJob(job)) return { state: 'complete', remaining: job.plan.summary };
  try {
    return await completeJob(job);
  } catch (error) {
    await failJob(job);
    throw error;
  }
}

/** Requires a real expiry timestamp and the entire post-deletion token-protection window. */
function guardExpired(job: QueryDocumentSnapshot): boolean {
  return (
    job.get('purgeAfter') instanceof Timestamp && job.get('purgeAfter').toMillis() <= Date.now()
  );
}

/** Removes an expired guard only after confirming that its Auth identity has not reappeared. */
async function purgeGuard(context: DeletionContext, job: QueryDocumentSnapshot): Promise<number> {
  if (!guardExpired(job)) return 0;
  try {
    await context.auth.getUser(job.id);
    return 0;
  } catch (error) {
    if (!isMissingAuth(error)) throw error;
  }
  await context.presence?.ref('presenceBlocks/' + job.id).remove();
  await job.ref.delete();
  return 1;
}

/** Explicitly maintains all expired completed guards; this is neither UID-filtered nor automatic TTL cleanup. */
export async function purgeCompleted(context: DeletionContext): Promise<number> {
  await requireDeletionRules(context);
  let removed = 0;
  const jobs = await context.db
    .collection('accountDeletions')
    .where('state', '==', 'complete')
    .get();
  for (const job of jobs.docs) removed += await purgeGuard(context, job);
  return removed;
}
