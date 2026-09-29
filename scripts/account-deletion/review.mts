import type { RoomInventory } from './room-content.mts';
import { roomImpact, placeholderPaths, remainingMembers } from './room-impact.mts';

/** Reports operator-only paths and impacts without exposing message text, passwords or session tokens. */
export function reviewRoom(room: RoomInventory, uid: string) {
  return reviewImpact(room, uid, roomImpact(room, uid));
}

/** Formats independently calculated effects for the operator's per-conversation review. */
function reviewImpact(room: RoomInventory, uid: string, impact: ReturnType<typeof roomImpact>) {
  return {
    path: room.room.ref.path,
    kind: room.room.data['kind'] ?? 'missing-parent',
    remainingMembers: remainingMembers(room, uid),
    ownMessages: impact.ownMessages,
    ownReactions: impact.ownReactions,
    foreignReactionsRemoved: impact.foreignReactionsOnOwnMessages,
    foreignMessagesPreserved: impact.foreignMessagesPreserved,
    placeholderPaths: placeholderPaths(room, uid),
    createsDirectArchive: !!impact.directArchives,
    reviewRequired: 'Fremde Texte, Zitate und gemeinsame Metadaten auf Angaben zum Konto prüfen.',
  };
}
