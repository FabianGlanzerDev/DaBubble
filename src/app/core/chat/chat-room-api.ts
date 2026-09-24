import {
  collection,
  doc,
  Firestore,
  runTransaction,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';
import { channelNameError, ChatRoom, directRoomId } from './chat-models';

export class ChatRoomApi {
  constructor(
    protected readonly db: Firestore,
    protected readonly uid: string,
  ) {}

  async createChannel(name: string, description: string): Promise<string> {
    this.validateChannel(name, description);
    const reference = doc(collection(this.db, 'conversations'));
    const key = name.trim().toLowerCase();
    await runTransaction(this.db, async (transaction) => {
      const index = doc(this.db, 'channelNames', key);
      if ((await transaction.get(index)).exists()) throw new Error('duplicate-channel');
      transaction.set(index, { roomId: reference.id });
      transaction.set(reference, this.channelData(name, description));
    });
    return reference.id;
  }

  private channelData(name: string, description: string) {
    return {
      kind: 'channel',
      name: name.trim(),
      nameKey: name.trim().toLowerCase(),
      description: description.trim(),
      memberIds: [this.uid],
      createdBy: this.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

  private validateChannel(name: string, description: string): void {
    if (channelNameError(name) || description.trim().length > 1000)
      throw new Error('invalid-channel');
  }

  async editChannel(room: ChatRoom, name: string, description: string): Promise<void> {
    this.validateChannel(name, description);
    const reference = doc(this.db, 'conversations', room.id);
    await runTransaction(this.db, async (transaction) => {
      const current = (await transaction.get(reference)).data() as ChatRoom;
      await this.rename(transaction, { ...current, id: room.id }, name.trim().toLowerCase());
      transaction.update(reference, this.channelChanges(name, description));
    });
  }

  private channelChanges(name: string, description: string) {
    return {
      name: name.trim(),
      nameKey: name.trim().toLowerCase(),
      description: description.trim(),
      updatedAt: serverTimestamp(),
    };
  }

  private async rename(transaction: Transaction, room: ChatRoom, key: string): Promise<void> {
    if (key === room.nameKey) return;
    const index = doc(this.db, 'channelNames', key);
    if ((await transaction.get(index)).exists()) throw new Error('duplicate-channel');
    transaction.delete(doc(this.db, 'channelNames', room.nameKey));
    transaction.set(index, { roomId: room.id });
  }

  async addMember(roomId: string, memberId: string): Promise<void> {
    const reference = doc(this.db, 'conversations', roomId);
    await runTransaction(this.db, async (transaction) => {
      const members = (await transaction.get(reference)).data()?.['memberIds'] as string[];
      if (!members?.includes(this.uid)) throw new Error('membership-changed');
      if (members.includes(memberId)) return;
      transaction.update(reference, {
        memberIds: [...members, memberId],
        updatedAt: serverTimestamp(),
      });
    });
  }

  async leaveChannel(roomId: string): Promise<void> {
    const reference = doc(this.db, 'conversations', roomId);
    await runTransaction(this.db, async (transaction) => {
      const members = (await transaction.get(reference)).data()?.['memberIds'] as string[];
      if (!members?.includes(this.uid)) throw new Error('membership-changed');
      transaction.update(reference, {
        memberIds: members.filter((id) => id !== this.uid),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async openDirect(otherUid: string): Promise<string> {
    const id = directRoomId(this.uid, otherUid),
      reference = doc(this.db, 'conversations', id);
    await runTransaction(this.db, async (transaction) => {
      if ((await transaction.get(reference)).exists()) return;
      transaction.set(reference, this.directData(otherUid));
    });
    return id;
  }

  private directData(otherUid: string) {
    return {
      ...this.channelData('', ''),
      kind: 'direct',
      memberIds: [...new Set([this.uid, otherUid])].sort(),
    };
  }
}
