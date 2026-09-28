import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { DocumentData, Query, Unsubscribe } from 'firebase/firestore';
import { ChatRoomApi } from './chat-room-api';
import { ChatMessage, ChatPerson, ChatReaction, ChatRoom } from './chat-models';

/** Provides live Firestore conversation data and writes scoped to the authenticated UID and server rules. */
export class ChatApi extends ChatRoomApi {
  /** Publishes only the display name and avatar to the current account's directory entry. */
  publishPerson(person: ChatPerson): Promise<void> {
    const { uid, name, avatarId } = person;
    return setDoc(doc(this.db, 'directory', this.uid), {
      uid,
      name,
      avatarId,
      updatedAt: serverTimestamp(),
    });
  }

  /** Streams the authenticated directory and returns a disposer for its Firestore listener. */
  people(next: (people: ChatPerson[]) => void, fail: (error: unknown) => void): Unsubscribe {
    return this.listen(
      query(collection(this.db, 'directory')),
      (rows) => next(rows as unknown as ChatPerson[]),
      fail,
    );
  }

  /** Streams only conversations whose membership array contains the current UID. */
  rooms(next: (rooms: ChatRoom[]) => void, fail: (error: unknown) => void): Unsubscribe {
    const source = query(
      collection(this.db, 'conversations'),
      where('memberIds', 'array-contains', this.uid),
    );
    return this.listen(source, (rows) => next(rows.map((row) => this.room(row))), fail);
  }

  /** Converts a room's server timestamp to milliseconds for client-side ordering. */
  private room(row: DocumentData): ChatRoom {
    return { ...row, createdAt: row['createdAt']?.toMillis() ?? 0 } as ChatRoom;
  }

  /** Streams one conversation's messages in creation order with normalized timestamps. */
  messages(
    roomId: string,
    next: (messages: ChatMessage[]) => void,
    fail: (error: unknown) => void,
  ): Unsubscribe {
    const source = query(
      collection(this.db, 'conversations', roomId, 'messages'),
      orderBy('createdAt'),
    );
    return this.listen(source, (rows) => next(rows.map((row) => this.message(row, roomId))), fail);
  }

  /** Streams the per-user reaction documents for a conversation under its membership rules. */
  reactions(
    roomId: string,
    next: (reactions: ChatReaction[]) => void,
    fail: (error: unknown) => void,
  ): Unsubscribe {
    return this.listen(
      query(collection(this.db, 'conversations', roomId, 'reactions')),
      (rows) => next(rows as unknown as ChatReaction[]),
      fail,
    );
  }

  /** Adds document IDs to snapshot data and forwards listener errors without hiding them. */
  private listen(
    source: Query,
    next: (rows: DocumentData[]) => void,
    fail: (error: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      source,
      (snapshot) => next(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))),
      fail,
    );
  }

  /** Adds room context and millisecond timestamps, with local display times for unresolved server timestamps. */
  private message(row: DocumentData, roomId: string): ChatMessage {
    return {
      ...row,
      roomId,
      createdAt: row['createdAt']?.toMillis() ?? Date.now(),
      updatedAt: row['updatedAt']?.toMillis() ?? Date.now(),
    } as ChatMessage;
  }

  /** Validates text and creates a root message or thread reply with the current UID and server timestamps. */
  async send(roomId: string, text: string, rootId = ''): Promise<void> {
    this.validateText(text);
    const reference = doc(collection(this.db, 'conversations', roomId, 'messages'));
    await setDoc(reference, {
      authorId: this.uid,
      text: text.trim(),
      rootId,
      deleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /** Updates message text and edit time; Firestore rules enforce author ownership. */
  edit(message: ChatMessage, text: string): Promise<void> {
    this.validateText(text);
    return updateDoc(doc(this.db, 'conversations', message.roomId, 'messages', message.id), {
      text: text.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  /** Clears message text and marks a tombstone while retaining identity, timestamps and thread structure. */
  remove(message: ChatMessage): Promise<void> {
    return updateDoc(doc(this.db, 'conversations', message.roomId, 'messages', message.id), {
      text: '',
      deleted: true,
      updatedAt: serverTimestamp(),
    });
  }

  /** Rejects blank messages and trimmed content longer than 4000 characters before sending. */
  private validateText(text: string): void {
    if (!text.trim() || text.trim().length > 4000) throw new Error('invalid-message');
  }

  /** Atomically toggles one emoji in the current user's reaction document, deleting an empty selection. */
  async react(message: ChatMessage, emoji: string): Promise<void> {
    const reference = this.reactionRef(message);
    await runTransaction(this.db, async (transaction) => {
      const emojis = (await transaction.get(reference)).data()?.['emojis'] as string[] | undefined;
      const next = emojis?.includes(emoji)
        ? emojis.filter((item) => item !== emoji)
        : [...(emojis ?? []), emoji];
      if (!next.length) transaction.delete(reference);
      else transaction.set(reference, this.reactionData(message.id, next));
    });
  }

  /** Builds the deterministic message-and-user document path used for one account's reactions. */
  private reactionRef(message: ChatMessage) {
    return doc(this.db, 'conversations', message.roomId, 'reactions', message.id + '_' + this.uid);
  }

  /** Associates a reaction selection with its message, current UID and server update timestamp. */
  private reactionData(messageId: string, emojis: string[]) {
    return { messageId, userId: this.uid, emojis, updatedAt: serverTimestamp() };
  }
}
