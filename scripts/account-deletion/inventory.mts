import { createHash } from 'node:crypto';
import type {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase-admin/firestore';
import type { DeletionContext } from './environment.mts';
import { isMissingAuth, validateUid } from './environment.mts';

/** Document reference and data together with its existence and update version for deletion-plan review. */
export type Row = {
  ref: DocumentReference;
  data: Record<string, unknown>;
  version: string;
  exists: boolean;
};
/** Conversation metadata and known child documents, including children whose parent document is missing. */
export type RoomInventory = { room: Row; exists: boolean; messages: Row[]; reactions: Row[] };
/** Extracts only string participant identifiers from untrusted conversation metadata. */
export const membersOf = (data: Record<string, unknown>): string[] =>
  Array.isArray(data['memberIds'])
    ? data['memberIds'].filter((v): v is string => typeof v === 'string')
    : [];
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

/** Reads the known conversation schema and refuses unknown collections that would escape targeted cleanup. */
export async function readRoom(reference: DocumentReference): Promise<RoomInventory> {
  const [snapshot, messages, reactions, collections] = await Promise.all([
    reference.get(),
    reference.collection('messages').get(),
    reference.collection('reactions').get(),
    reference.listCollections(),
  ]);
  if (collections.some((item) => !['messages', 'reactions'].includes(item.id)))
    throw new Error('Unbekannte Unterkollektion im Gespräch. Manuelle Prüfung erforderlich.');
  await Promise.all([
    assertNoNestedData(reference.collection('messages')),
    assertNoNestedData(reference.collection('reactions')),
  ]);
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

/** Preserves other authors' messages and replaces removed roots only when their replies still require structure. */
export function remainingMessages(
  room: RoomInventory,
  uid: string,
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  const foreignRoots = new Set(
    room.messages
      .filter((m) => m.data['authorId'] !== uid && m.data['authorId'] !== '')
      .map((m) => m.data['rootId']),
  );
  for (const message of room.messages) {
    if (
      message.data['authorId'] === '' &&
      message.data['deleted'] === true &&
      !foreignRoots.has(message.ref.id)
    )
      continue;
    if (message.data['authorId'] !== uid) result.set(message.ref.id, message.data);
    else if (foreignRoots.has(message.ref.id))
      result.set(message.ref.id, {
        authorId: '',
        text: '',
        deleted: true,
        rootId: '',
        createdAt: message.data['createdAt'],
        updatedAt: message.data['updatedAt'],
      });
  }
  return result;
}

/** Builds a read-only account impact plan and fingerprint from affected document versions, without printing chat content. */
export async function inventory(context: DeletionContext, uid: string) {
  validateUid(uid);
  let accountExists = true;
  let account: { email: string | null; providerIds: string[]; createdAt: string } | null = null;
  try {
    const user = await context.auth.getUser(uid);
    account = {
      email: user.email ?? null,
      providerIds: user.providerData.map((provider) => provider.providerId).sort(),
      createdAt: user.metadata.creationTime,
    };
  } catch (error) {
    if (!isMissingAuth(error)) throw error;
    accountExists = false;
  }
  const profile = row(await context.db.doc('users/' + uid).get());
  const directory = row(await context.db.doc('directory/' + uid).get());
  // listDocuments also discovers missing parent documents with surviving subcollections.
  const rooms: RoomInventory[] = [];
  for (const reference of await context.db.collection('conversations').listDocuments()) {
    const candidate = await readRoom(reference);
    if (affected(candidate, uid)) rooms.push(candidate);
  }
  const summary = {
    project: context.project,
    database: '(default)',
    uid,
    accountExists,
    profileExists: profile.exists,
    directoryExists: directory.exists,
    rooms: rooms.length,
    ownMessages: 0,
    ownReactions: 0,
    threadPlaceholders: 0,
    foreignReactionsOnOwnMessages: 0,
    foreignMessagesPreserved: 0,
    directArchives: 0,
    sharedTextReview:
      'Fremde Texte, Zitate, Namen und Beschreibungen werden nicht automatisch bereinigt.',
  };
  for (const room of rooms) {
    const own = room.messages.filter((m) => m.data['authorId'] === uid);
    const ids = new Set(own.map((m) => m.ref.id));
    const remaining = remainingMessages(room, uid);
    summary.ownMessages += own.length;
    summary.ownReactions += room.reactions.filter((r) => r.data['userId'] === uid).length;
    summary.threadPlaceholders += own.filter((m) => remaining.has(m.ref.id)).length;
    summary.foreignMessagesPreserved += room.messages.filter(
      (m) => m.data['authorId'] !== uid && remaining.has(m.ref.id),
    ).length;
    summary.foreignReactionsOnOwnMessages += room.reactions.filter(
      (r) => r.data['userId'] !== uid && ids.has(String(r.data['messageId'])),
    ).length;
    if (room.room.data['kind'] === 'direct' && room.room.ref.id.startsWith('dm_') && remaining.size)
      summary.directArchives++;
  }
  const versions = [
    profile,
    directory,
    ...rooms.flatMap((r) => [r.room, ...r.messages, ...r.reactions]),
  ]
    .map((r) => r.ref.path + ':' + r.version)
    .sort();
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ summary, account, versions }))
    .digest('hex');
  return { summary, account, rooms, fingerprint };
}
