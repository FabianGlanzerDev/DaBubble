import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { readRoom } from './inventory.mts';
import { membersOf, remainingMessages } from './room-content.mts';
import { needsArchive } from './room-impact.mts';
import { archiveDirect, finishArchive } from './direct-archive.mts';
import type { RoomInventory } from './room-content.mts';

import { commitChunks } from './cleanup-writes.mts';
import type { Write } from './cleanup-writes.mts';
export { commitChunks } from './cleanup-writes.mts';

/** Messages retained after removing the target account's identifying content. */
type RetainedMessages = ReturnType<typeof remainingMessages>;

/** Claims a stable archive ID or refuses an overlapping cleanup for another account. */
async function lockRoom(db: Firestore, reference: DocumentReference, uid: string) {
  const lock = db.doc('deletionLocks/' + reference.id);
  const archiveId = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(lock);
    if (snapshot.exists && snapshot.get('uid') !== uid)
      throw new Error('Gespräch wird bereits bearbeitet. Später erneut starten.');
    if (snapshot.exists) return String(snapshot.get('archiveId'));
    const id = 'archive_' + db.collection('conversations').doc().id;
    tx.create(lock, { uid, archiveId: id });
    return id;
  });
  return { lock, archiveId };
}

/** Keeps only other people's reactions on messages that remain available after this deletion. */
function retainedReactions(room: RoomInventory, uid: string, remaining: Map<string, unknown>) {
  const removed = new Set(
    room.messages
      .filter((m) => m.data['authorId'] === uid || !remaining.has(m.ref.id))
      .map((m) => m.ref.id),
  );
  return room.reactions.filter(
    (r) => r.data['userId'] !== uid && !removed.has(String(r.data['messageId'])),
  );
}

/** Converts the rejected reactions into writes that run before their target messages are changed. */
function reactionRemovals(room: RoomInventory, reactions: RoomInventory['reactions']): Write[] {
  const changes: Write[] = room.reactions
    .filter((r) => !reactions.includes(r))
    .map((r) => (batch) => {
      batch.delete(r.ref);
    });
  return changes;
}

/** Queues reaction removal before message changes so interrupted runs still identify original authors. */
function roomWrites(room: RoomInventory, uid: string, remaining: RetainedMessages) {
  const reactions = retainedReactions(room, uid, remaining);
  const changes = reactionRemovals(room, reactions);
  for (const message of room.messages) {
    if (message.data['authorId'] !== uid && remaining.has(message.ref.id)) continue;
    const retained = remaining.get(message.ref.id);
    changes.push((batch) => {
      if (retained) batch.set(message.ref, retained);
      else batch.delete(message.ref);
    });
  }
  return changes;
}

/** Removes empty channel metadata or keeps the conversation for remaining authors and members. */
async function finishRoom(db: Firestore, room: RoomInventory, uid: string) {
  if (!room.exists) return;
  const members = membersOf(room.room.data).filter((id) => id !== uid);
  const remaining = remainingMessages(room, uid);
  if (!members.length && !remaining.size && !retainedReactions(room, uid, remaining).length)
    await removeEmptyRoom(db, room);
  else
    await room.room.ref.update({
      memberIds: members,
      ...(room.room.data['createdBy'] === uid ? { createdBy: '' } : {}),
    });
}

/** Shared state for one locked conversation and the lease-renewal callback. */
type RoomCleanup = {
  db: Firestore;
  room: RoomInventory;
  uid: string;
  archiveId: string;
  heartbeat: () => Promise<void>;
};

/** Carries only retained participants, messages and reactions into a direct-chat archive. */
function archivePlan(plan: RoomCleanup, remaining: Map<string, Record<string, unknown>>) {
  return {
    ...plan,
    messages: remaining,
    members: membersOf(plan.room.room.data).filter((id) => id !== plan.uid),
    reactions: retainedReactions(plan.room, plan.uid, remaining),
  };
}

/** Applies the appropriate in-place cleanup or UID-neutral direct-chat migration. */
async function cleanContents(plan: RoomCleanup) {
  const { db, room, uid, heartbeat } = plan;
  const remaining = remainingMessages(room, uid);
  if (needsArchive(room, remaining)) {
    await archiveDirect(archivePlan(plan, remaining));
  } else {
    await commitChunks(db, roomWrites(room, uid, remaining), heartbeat);
    await finishRoom(db, room, uid);
  }
}

/** Locks one affected conversation and resumes a prepared archive before releasing its deletion lock. */
export async function cleanRoom(
  db: Firestore,
  reference: DocumentReference,
  uid: string,
  heartbeat: () => Promise<void>,
) {
  const { lock, archiveId } = await lockRoom(db, reference, uid);
  const room = await readRoom(reference);
  if ((await lock.get()).get('archiveReady') === true)
    await finishArchive(db, room, archiveId, heartbeat);
  else await cleanContents({ db, room, uid, archiveId, heartbeat });
  await lock.delete();
}

/** Deletes empty conversation metadata and only the channel-name reservation that still points to it. */
async function removeEmptyRoom(db: Firestore, room: RoomInventory): Promise<void> {
  await db.runTransaction(async (tx) => {
    const name = room.room.data['nameKey'];
    const index =
      room.room.data['kind'] === 'channel' && typeof name === 'string' && name
        ? db.doc('channelNames/' + name)
        : null;
    const entry = index ? await tx.get(index) : null;
    if (index && entry?.get('roomId') === room.room.ref.id) tx.delete(index);
    tx.delete(room.room.ref);
  });
}

/** Recursively removes the target's profile and directory trees, including administrative child collections. */
export async function finishProfile(db: Firestore, uid: string): Promise<void> {
  // recursiveDelete also handles any administrative subcollections below profile documents.
  await db.recursiveDelete(db.doc('users/' + uid));
  await db.recursiveDelete(db.doc('directory/' + uid));
}
