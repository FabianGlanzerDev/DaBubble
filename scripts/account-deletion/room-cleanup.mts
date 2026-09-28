import type { DocumentReference, Firestore, WriteBatch } from 'firebase-admin/firestore';
import { membersOf, readRoom, remainingMessages } from './inventory.mts';
import type { RoomInventory } from './inventory.mts';

type Write = (batch: WriteBatch) => void;
export async function commitChunks(
  db: Firestore,
  changes: Write[],
  heartbeat: () => Promise<void>,
): Promise<void> {
  for (let i = 0; i < changes.length; i += 350) {
    await heartbeat();
    const batch = db.batch();
    for (const change of changes.slice(i, i + 350)) change(batch);
    await batch.commit();
  }
}

export async function cleanRoom(
  db: Firestore,
  reference: DocumentReference,
  uid: string,
  heartbeat: () => Promise<void>,
) {
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
  const room = await readRoom(reference);
  if ((await lock.get()).get('archiveReady') === true) {
    await finishArchive(db, room, archiveId, heartbeat);
    await lock.delete();
    return;
  }
  const remaining = remainingMessages(room, uid);
  const ownIds = new Set(
    room.messages
      .filter((m) => m.data['authorId'] === uid || !remaining.has(m.ref.id))
      .map((m) => m.ref.id),
  );
  const reactions = room.reactions.filter(
    (r) => r.data['userId'] !== uid && !ownIds.has(String(r.data['messageId'])),
  );
  const members = membersOf(room.room.data).filter((id) => id !== uid);
  const migrate =
    room.room.data['kind'] === 'direct' && reference.id.startsWith('dm_') && remaining.size > 0;

  if (migrate) {
    await archiveDirect(db, room, archiveId, uid, members, remaining, reactions, heartbeat);
  } else {
    const changes: Write[] = [];
    // Reactions first: a retry must still identify the original authors of all target messages.
    for (const reaction of room.reactions)
      if (!reactions.includes(reaction)) changes.push((batch) => batch.delete(reaction.ref));
    for (const message of room.messages) {
      if (message.data['authorId'] !== uid && remaining.has(message.ref.id)) continue;
      const retained = remaining.get(message.ref.id);
      changes.push((batch) =>
        retained ? batch.set(message.ref, retained) : batch.delete(message.ref),
      );
    }
    await commitChunks(db, changes, heartbeat);
    if (room.exists) {
      if (!members.length && !remaining.size && !reactions.length) {
        await removeEmptyRoom(db, room);
      } else
        await reference.update({
          memberIds: members,
          ...(room.room.data['createdBy'] === uid ? { createdBy: '' } : {}),
        });
    }
  }
  await lock.delete();
}

async function archiveDirect(
  db: Firestore,
  room: RoomInventory,
  archiveId: string,
  uid: string,
  members: string[],
  messages: Map<string, Record<string, unknown>>,
  reactions: RoomInventory['reactions'],
  heartbeat: () => Promise<void>,
): Promise<void> {
  const target = db.doc('conversations/' + archiveId);
  const targetLock = db.doc('deletionLocks/' + archiveId);
  await targetLock.set({ uid, archiveId });
  // Hidden from client queries until the complete transcript has been copied.
  const data = {
    ...room.room.data,
    memberIds: [],
    archived: true,
    createdBy: room.room.data['createdBy'] === uid ? '' : room.room.data['createdBy'],
  };
  await target.set(data);
  const writes: Write[] = [];
  for (const [id, value] of messages)
    writes.push((batch) => batch.set(target.collection('messages').doc(id), value));
  for (const item of reactions)
    writes.push((batch) => batch.set(target.collection('reactions').doc(item.ref.id), item.data));
  await commitChunks(db, writes, heartbeat);
  // Make the archive durable and visible before removing its source. Resume uses the same ID.
  await target.update({ memberIds: members });
  await db.doc('deletionLocks/' + room.room.ref.id).update({ archiveReady: true });
  await finishArchive(db, room, archiveId, heartbeat);
}

async function finishArchive(
  db: Firestore,
  room: RoomInventory,
  archiveId: string,
  heartbeat: () => Promise<void>,
) {
  if (!(await db.doc('conversations/' + archiveId).get()).exists)
    throw new Error('Vorbereitetes Archiv fehlt. Keine weiteren Daten entfernt.');
  const removals = [...room.messages, ...room.reactions].map((item): Write => (batch) => {
    batch.delete(item.ref);
  });
  await commitChunks(db, removals, heartbeat);
  const finish = db.batch();
  finish.delete(room.room.ref);
  finish.delete(db.doc('deletionLocks/' + archiveId));
  await finish.commit();
}

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

export async function finishProfile(db: Firestore, uid: string): Promise<void> {
  // recursiveDelete also handles any administrative subcollections below profile documents.
  await db.recursiveDelete(db.doc('users/' + uid));
  await db.recursiveDelete(db.doc('directory/' + uid));
}
