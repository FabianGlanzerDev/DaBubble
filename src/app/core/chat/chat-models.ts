/** Directory identity used to display participants without exposing private profile fields. */
export interface ChatPerson {
  uid: string;
  name: string;
  avatarId: number;
  demo?: boolean;
}
/** Conversation metadata, membership and optional archive state shared by channels and direct chats. */
export interface ChatRoom {
  id: string;
  kind: 'channel' | 'direct';
  name: string;
  nameKey: string;
  description: string;
  memberIds: string[];
  createdBy: string;
  createdAt?: number;
  archived?: boolean;
  publicDemo?: boolean;
}
/** Conversation message with an optional root reference; deleted messages retain metadata as tombstones. */
export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  text: string;
  rootId: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
}
/** One user's emoji selections for a message, represented by a deterministic Firestore document. */
export interface ChatReaction {
  id: string;
  messageId: string;
  userId: string;
  emojis: string[];
}
export const chatEmojis = [
  '✅',
  '🙌',
  '😀',
  '👍',
  '👏',
  '❤️',
  '😎',
  '🤔',
  '🚀',
  '🤓',
  '🎉',
  '😂',
  '😊',
  '🔥',
  '💡',
  '👀',
  '💪',
  '🙏',
  '😢',
  '🎯',
];

/** Returns localized validation feedback for the allowed 1-80 character channel naming format. */
export function channelNameError(name: string): string {
  if (!name.trim()) return 'Bitte gib einen Channel-Namen ein.';
  return /^[a-zäöüß0-9][a-zäöüß0-9 _-]{0,79}$/i.test(name.trim())
    ? ''
    : 'Bitte verwende 1–80 Buchstaben, Zahlen, Leerzeichen, - oder _. Beginne mit einem Buchstaben oder einer Zahl.';
}

/** Produces the same room ID for either participant order and supports a one-member self conversation. */
export function directRoomId(first: string, second: string): string {
  return 'dm_' + [...new Set([first, second])].sort().join('~');
}

/** Maps domain validation and connectivity failures to safe feedback without exposing raw service errors. */
export function chatError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'duplicate-channel') return 'Dieser Channel-Name ist bereits vergeben.';
  if (code === 'invalid-channel')
    return 'Bitte prüfe Channel-Name und Beschreibung (maximal 1000 Zeichen).';
  if (code === 'invalid-message') return 'Eine Nachricht benötigt 1–4000 Zeichen.';
  if (code === 'membership-changed') return 'Du bist nicht mehr Mitglied dieser Unterhaltung.';
  if (code === 'offline')
    return 'Du bist offline. Dein Entwurf bleibt erhalten. Bitte versuche es nach dem Verbinden erneut.';
  return 'Chat-Daten konnten nicht geladen oder gespeichert werden. Bitte prüfe Verbindung und Zugriffsrechte und versuche es erneut.';
}
