import { membersOf, remainingMessages } from './room-content.mts';
import type { RoomInventory, Row } from './room-content.mts';

/** Identifies direct conversations whose retained content needs a UID-neutral archive. */
export function needsArchive(room: RoomInventory, remaining: Map<string, unknown>): boolean {
  return (
    room.room.data['kind'] === 'direct' && room.room.ref.id.startsWith('dm_') && remaining.size > 0
  );
}

/** Counts reactions belonging to other people that cannot outlive their removed target message. */
function foreignReactions(room: RoomInventory, uid: string, own: Row[]): number {
  const ids = new Set(own.map((message) => message.ref.id));
  return room.reactions.filter(
    (reaction) => reaction.data['userId'] !== uid && ids.has(String(reaction.data['messageId'])),
  ).length;
}

/** Calculates preservation and removal counts without exporting any message text. */
export function roomImpact(room: RoomInventory, uid: string) {
  const own = room.messages.filter((message) => message.data['authorId'] === uid);
  const remaining = remainingMessages(room, uid);
  return {
    ownMessages: own.length,
    ownReactions: room.reactions.filter((reaction) => reaction.data['userId'] === uid).length,
    threadPlaceholders: own.filter((message) => remaining.has(message.ref.id)).length,
    foreignMessagesPreserved: room.messages.filter(
      (m) => m.data['authorId'] !== uid && remaining.has(m.ref.id),
    ).length,
    foreignReactionsOnOwnMessages: foreignReactions(room, uid, own),
    directArchives: Number(needsArchive(room, remaining)),
  };
}

/** Exposes only the paths of structurally necessary placeholders to the reviewing operator. */
export function placeholderPaths(room: RoomInventory, uid: string): string[] {
  const remaining = remainingMessages(room, uid);
  return room.messages
    .filter((message) => message.data['authorId'] === uid && remaining.has(message.ref.id))
    .map((message) => message.ref.path);
}

/** Counts participants remaining after the target account is removed. */
export function remainingMembers(room: RoomInventory, uid: string): number {
  return membersOf(room.room.data).filter((member) => member !== uid).length;
}
