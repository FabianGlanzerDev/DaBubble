import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { RoomInventory } from './room-content.mts';
import { commitChunks } from './cleanup-writes.mts';
import type { Write } from './cleanup-writes.mts';

/** Reviewed retained data and lease callback for one resumable direct-chat archive. */
type ArchivePlan = {
  db: Firestore;
  room: RoomInventory;
  archiveId: string;
  uid: string;
  members: string[];
  messages: Map<string, Record<string, unknown>>;
  reactions: RoomInventory['reactions'];
  heartbeat: () => Promise<void>;
};

/** Creates a locked archive hidden from member queries until its transcript is completely copied. */
async function prepareArchive(plan: ArchivePlan) {
  const { db, room, archiveId, uid } = plan;
  const target = db.doc('conversations/' + archiveId);
  await db.doc('deletionLocks/' + archiveId).set({ uid, archiveId });
  await target.set({
    ...room.room.data,
    memberIds: [],
    archived: true,
    createdBy: room.room.data['createdBy'] === uid ? '' : room.room.data['createdBy'],
  });
  return target;
}

/** Queues a complete retained transcript before the archive becomes visible to its members. */
function archiveWrites(plan: ArchivePlan, target: DocumentReference): Write[] {
  const writes: Write[] = [];
  for (const [id, value] of plan.messages)
    writes.push((batch) => {
      batch.set(target.collection('messages').doc(id), value);
    });
  for (const item of plan.reactions)
    writes.push((batch) => {
      batch.set(target.collection('reactions').doc(item.ref.id), item.data);
    });
  return writes;
}

/** Makes retained content durable and visible before deleting the original UID-bearing conversation. */
export async function archiveDirect(plan: ArchivePlan): Promise<void> {
  const target = await prepareArchive(plan);
  await commitChunks(plan.db, archiveWrites(plan, target), plan.heartbeat);
  await target.update({ memberIds: plan.members });
  await plan.db.doc('deletionLocks/' + plan.room.room.ref.id).update({ archiveReady: true });
  await finishArchive(plan.db, plan.room, plan.archiveId, plan.heartbeat);
}

/** Deletes the source's now-copied child documents without removing any retained archive content. */
async function removeSource(db: Firestore, room: RoomInventory, heartbeat: () => Promise<void>) {
  const removals = [...room.messages, ...room.reactions].map((item): Write => (batch) => {
    batch.delete(item.ref);
  });
  await commitChunks(db, removals, heartbeat);
}

/** Requires a prepared archive before atomically removing source metadata and the archive lock. */
export async function finishArchive(
  db: Firestore,
  room: RoomInventory,
  archiveId: string,
  heartbeat: () => Promise<void>,
) {
  if (!(await db.doc('conversations/' + archiveId).get()).exists)
    throw new Error('Vorbereitetes Archiv fehlt. Keine weiteren Daten entfernt.');
  await removeSource(db, room, heartbeat);
  const finish = db.batch();
  finish.delete(room.room.ref);
  finish.delete(db.doc('deletionLocks/' + archiveId));
  await finish.commit();
}
