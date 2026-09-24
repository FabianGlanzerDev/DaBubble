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

export class ChatApi extends ChatRoomApi {
  publishPerson(person: ChatPerson): Promise<void> {
    const { uid, name, avatarId } = person;
    return setDoc(doc(this.db, 'directory', this.uid), {
      uid,
      name,
      avatarId,
      updatedAt: serverTimestamp(),
    });
  }

  people(next: (people: ChatPerson[]) => void, fail: (error: unknown) => void): Unsubscribe {
    return this.listen(
      query(collection(this.db, 'directory')),
      (rows) => next(rows as unknown as ChatPerson[]),
      fail,
    );
  }

  rooms(next: (rooms: ChatRoom[]) => void, fail: (error: unknown) => void): Unsubscribe {
    const source = query(
      collection(this.db, 'conversations'),
      where('memberIds', 'array-contains', this.uid),
    );
    return this.listen(source, (rows) => next(rows as unknown as ChatRoom[]), fail);
  }

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

  private message(row: DocumentData, roomId: string): ChatMessage {
    return {
      ...row,
      roomId,
      createdAt: row['createdAt']?.toMillis() ?? Date.now(),
      updatedAt: row['updatedAt']?.toMillis() ?? Date.now(),
    } as ChatMessage;
  }

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

  edit(message: ChatMessage, text: string): Promise<void> {
    this.validateText(text);
    return updateDoc(doc(this.db, 'conversations', message.roomId, 'messages', message.id), {
      text: text.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  remove(message: ChatMessage): Promise<void> {
    return updateDoc(doc(this.db, 'conversations', message.roomId, 'messages', message.id), {
      text: '',
      deleted: true,
      updatedAt: serverTimestamp(),
    });
  }

  private validateText(text: string): void {
    if (!text.trim() || text.trim().length > 4000) throw new Error('invalid-message');
  }

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

  private reactionRef(message: ChatMessage) {
    return doc(this.db, 'conversations', message.roomId, 'reactions', message.id + '_' + this.uid);
  }

  private reactionData(messageId: string, emojis: string[]) {
    return { messageId, userId: this.uid, emojis, updatedAt: serverTimestamp() };
  }
}
