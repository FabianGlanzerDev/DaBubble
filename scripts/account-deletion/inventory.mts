import type {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase-admin/firestore';
import type { DeletionContext } from './environment.mts';
import { validateUid } from './environment.mts';
import { membersOf } from './room-content.mts';
import type { Row, RoomInventory } from './room-content.mts';
export { membersOf, remainingMessages } from './room-content.mts';
export type { Row, RoomInventory } from './room-content.mts';
import { describeAccount, summarizePlan, fingerprintPlan } from './inventory-summary.mts';

/** Preserves document location, data and update version even for a missing parent document. */
const row = (snapshot: DocumentSnapshot): Row => ({
  ref: snapshot.ref,
  data: snapshot.data() ?? {},
  version: JSON.stringify(snapshot.updateTime ?? null),
  exists: snapshot.exists,
});

/** Stops deletion planning when message or reaction references contain unrecognized nested collections. */
async function assertNoNestedData(collection: CollectionReference): Promise<void> {
  // Query snapshots omit missing parent documents. Inspect those references as well.
  const references = await collection.listDocuments();
  for (let offset = 0; offset < references.length; offset += 50) {
    await Promise.all(
      references.slice(offset, offset + 50).map(async (reference) => {
        if ((await reference.listCollections()).length)
          throw new Error(
            `Unerwartete Unterkollektion unter ${reference.path}. Manuelle Prüfung erforderlich.`,
          );
      }),
    );
  }
}

/** Refuses collections outside the supported conversation schema before any removal is planned. */
async function validateRoom(reference: DocumentReference): Promise<void> {
  const collections = await reference.listCollections();
  if (collections.some((item) => !['messages', 'reactions'].includes(item.id)))
    throw new Error('Unbekannte Unterkollektion im Gespräch. Manuelle Prüfung erforderlich.');
  await Promise.all(
    ['messages', 'reactions'].map((name) => assertNoNestedData(reference.collection(name))),
  );
}

/** Reads supported child documents, including data below a missing conversation parent. */
export async function readRoom(reference: DocumentReference): Promise<RoomInventory> {
  const [snapshot, messages, reactions] = await Promise.all([
    reference.get(),
    reference.collection('messages').get(),
    reference.collection('reactions').get(),
  ]);
  await validateRoom(reference);
  return {
    room: row(snapshot),
    exists: snapshot.exists,
    messages: messages.docs.map(row),
    reactions: reactions.docs.map(row),
  };
}

/** Detects UID references in membership, creation, direct-room IDs, message authorship or reaction ownership. */
export function affected(room: RoomInventory, uid: string): boolean {
  return (
    membersOf(room.room.data).includes(uid) ||
    room.room.data['createdBy'] === uid ||
    (room.room.ref.id.startsWith('dm_') && room.room.ref.id.slice(3).split('~').includes(uid)) ||
    room.messages.some((item) => item.data['authorId'] === uid) ||
    room.reactions.some((item) => item.data['userId'] === uid)
  );
}

/** Discovers affected conversations even when only their subcollections still exist. */
async function affectedRooms(context: DeletionContext, uid: string): Promise<RoomInventory[]> {
  const rooms: RoomInventory[] = [];
  for (const reference of await context.db.collection('conversations').listDocuments()) {
    const candidate = await readRoom(reference);
    if (affected(candidate, uid)) rooms.push(candidate);
  }
  return rooms;
}

/** Builds a read-only impact plan with a fingerprint covering account and affected document versions. */
export async function inventory(context: DeletionContext, uid: string) {
  validateUid(uid);
  const account = await describeAccount(context, uid);
  const profiles = await profileRows(context, uid);
  const rooms = await affectedRooms(context, uid);
  const summary = summarizePlan(
    { project: context.project, uid, accountExists: account !== null },
    profiles,
    rooms,
  );
  const fingerprint = fingerprintPlan(summary, account, Object.values(profiles), rooms);
  return { summary, account, rooms, fingerprint };
}

/** Reads private profile, directory and proof documents for the same reviewed account. */
async function profileRows(context: DeletionContext, uid: string) {
  const [profile, directory, proof] = await Promise.all(
    ['users', 'directory', 'deletionProofs'].map(async (name) =>
      row(await context.db.doc(name + '/' + uid).get()),
    ),
  );
  return { profile: profile!, directory: directory!, proof: proof! };
}
