import { membersOf, remainingMessages } from './inventory.mts';
import type { RoomInventory } from './inventory.mts';

/** Operator-only paths/counts: never export message text, password hashes or session tokens. */
export function reviewRoom(room: RoomInventory, uid: string) {
  const own = room.messages.filter((message) => message.data['authorId'] === uid);
  const ownIds = new Set(own.map((message) => message.ref.id));
  const remaining = remainingMessages(room, uid);
  return {
    path: room.room.ref.path,
    kind: room.room.data['kind'] ?? 'missing-parent',
    remainingMembers: membersOf(room.room.data).filter((member) => member !== uid).length,
    ownMessages: own.length,
    ownReactions: room.reactions.filter((reaction) => reaction.data['userId'] === uid).length,
    foreignReactionsRemoved: room.reactions.filter(
      (reaction) =>
        reaction.data['userId'] !== uid && ownIds.has(String(reaction.data['messageId'])),
    ).length,
    foreignMessagesPreserved: room.messages.filter(
      (message) => message.data['authorId'] !== uid && remaining.has(message.ref.id),
    ).length,
    placeholderPaths: own.filter((message) => remaining.has(message.ref.id)).map((m) => m.ref.path),
    createsDirectArchive:
      room.room.data['kind'] === 'direct' &&
      room.room.ref.id.startsWith('dm_') &&
      remaining.size > 0,
    reviewRequired: 'Fremde Texte, Zitate und gemeinsame Metadaten auf Angaben zum Konto prüfen.',
  };
}
