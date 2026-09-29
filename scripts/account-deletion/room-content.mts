import type { DocumentReference } from 'firebase-admin/firestore';

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

/** Removes identifying root content while retaining timestamps and a stable target for foreign replies. */
function placeholder(message: Row): Record<string, unknown> {
  return {
    authorId: '',
    text: '',
    deleted: true,
    rootId: '',
    createdAt: message.data['createdAt'],
    updatedAt: message.data['updatedAt'],
  };
}

/** Selects retained content or a structural placeholder; obsolete placeholders are discarded. */
function retainedMessage(message: Row, uid: string, roots: Set<unknown>) {
  if (
    message.data['authorId'] === '' &&
    message.data['deleted'] === true &&
    !roots.has(message.ref.id)
  )
    return null;
  if (message.data['authorId'] !== uid) return message.data;
  return roots.has(message.ref.id) ? placeholder(message) : null;
}

/** Finds roots still referenced by replies belonging to other identifiable authors. */
function foreignRoots(room: RoomInventory, uid: string) {
  return new Set(
    room.messages
      .filter((m) => m.data['authorId'] !== uid && m.data['authorId'] !== '')
      .map((m) => m.data['rootId']),
  );
}

/** Preserves other authors' messages and retains removed roots only when their replies need them. */
export function remainingMessages(
  room: RoomInventory,
  uid: string,
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  const roots = foreignRoots(room, uid);
  for (const message of room.messages) {
    const retained = retainedMessage(message, uid, roots);
    if (retained) result.set(message.ref.id, retained);
  }
  return result;
}
