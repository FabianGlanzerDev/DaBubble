import type { DeletionContext } from './environment.mts';
import { isMissingAuth } from './environment.mts';
import type { DeletionJob } from './deletion-job.mts';
import { renewLease } from './deletion-job.mts';
import { inventory } from './inventory.mts';
import { cleanRoom, finishProfile } from './room-cleanup.mts';
import { blockPresence } from './presence.mts';

/** Disables new sign-ins and revokes refresh tokens; a previously removed account is safe to resume. */
async function disableAccount(context: DeletionContext, uid: string): Promise<void> {
  try {
    await context.auth.updateUser(uid, { disabled: true });
    await context.auth.revokeRefreshTokens(uid);
  } catch (error) {
    if (!isMissingAuth(error)) throw error;
  }
}

/** Includes unfinished migrations after blocking stale tokens and new invitations with the job marker. */
async function lockedRooms(job: DeletionJob) {
  const { context, uid } = job;
  const plan = await inventory(context, uid);
  const references = new Map(plan.rooms.map((room) => [room.room.ref.id, room.room.ref]));
  const pending = await context.db.collection('deletionLocks').where('uid', '==', uid).get();
  for (const lock of pending.docs)
    if (lock.id !== lock.get('archiveId'))
      references.set(lock.id, context.db.doc('conversations/' + lock.id));
  return references.values();
}

/** Verifies that target-owned profile data, room references and migration locks are gone. */
async function verifyCleanup(context: DeletionContext, uid: string) {
  const remaining = await inventory(context, uid);
  const locks = await context.db.collection('deletionLocks').where('uid', '==', uid).get();
  if (
    remaining.rooms.length ||
    remaining.summary.profileExists ||
    remaining.summary.directoryExists ||
    !locks.empty
  )
    throw new Error('Verknüpfte Daten verbleiben. Vorgang erneut aufnehmen.');
  return remaining.summary;
}

/** Removes the Auth account after chat cleanup and requires a missing-user response as confirmation. */
export async function removeAuth(context: DeletionContext, uid: string): Promise<void> {
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
}

/** Cleans the blocked account's chat and profile data while keeping other authors' content. */
export async function cleanAccount(job: DeletionJob) {
  const { context, uid } = job;
  await blockPresence(context.presence, uid);
  await disableAccount(context, uid);
  for (const reference of await lockedRooms(job)) {
    await renewLease(job);
    await cleanRoom(context.db, reference, uid, () => renewLease(job));
  }
  await finishProfile(context.db, uid);
  return verifyCleanup(context, uid);
}
