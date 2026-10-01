import {
  collection,
  doc,
  Firestore,
  runTransaction,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';
import { channelNameError, ChatRoom, directRoomId } from './chat-models';

/** Creates and changes conversation metadata transactionally while Firestore enforces membership boundaries. */
export class ChatRoomApi {
  /** Binds conversation operations to one authenticated UID and its configured Firestore client. */
  constructor(
    protected readonly db: Firestore,
    protected readonly uid: string,
  ) {}

  /** Reserves the normalized name and creates the creator's channel in one transaction. */
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

  /** Builds initial channel metadata with the creator as the sole member and server timestamps. */
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

  /** Checks channel naming rules and the 1000-character description limit before writing. */
  private validateChannel(name: string, description: string): void {
    if (channelNameError(name) || description.trim().length > 1000)
      throw new Error('invalid-channel');
  }

  /** Updates channel metadata together with any required unique-name reservation change. */
  async editChannel(room: ChatRoom, name: string, description: string): Promise<void> {
    this.validateChannel(name, description);
    const reference = doc(this.db, 'conversations', room.id);
    await runTransaction(this.db, async (transaction) => {
      const current = (await transaction.get(reference)).data() as ChatRoom;
      await this.rename(transaction, { ...current, id: room.id }, name.trim().toLowerCase());
      transaction.update(reference, this.channelChanges(name, description));
    });
  }

  /** Normalizes editable channel fields and assigns a server-side modification time. */
  private channelChanges(name: string, description: string) {
    return {
      name: name.trim(),
      nameKey: name.trim().toLowerCase(),
      description: description.trim(),
      updatedAt: serverTimestamp(),
    };
  }

  /** Moves the unique-name reservation atomically and rejects names already assigned to a room. */
  private async rename(transaction: Transaction, room: ChatRoom, key: string): Promise<void> {
    if (key === room.nameKey) return;
    const index = doc(this.db, 'channelNames', key);
    if ((await transaction.get(index)).exists()) throw new Error('duplicate-channel');
    transaction.delete(doc(this.db, 'channelNames', room.nameKey));
    transaction.set(index, { roomId: room.id });
  }

  /** Adds a UID only while the acting user remains a member, preserving concurrent membership changes. */
  async addMember(roomId: string, memberId: string): Promise<void> {
    const reference = doc(this.db, 'conversations', roomId);
    await runTransaction(this.db, async (transaction) => {
      const members = (await transaction.get(reference)).data()?.['memberIds'] as string[];
      if (!members?.includes(this.uid)) throw new Error('membership-changed');
      if (members.includes(memberId)) return;
      if (members.length >= 100) throw new Error('channel-full');
      transaction.update(reference, {
        memberIds: [...members, memberId],
        updatedAt: serverTimestamp(),
      });
    });
  }

  /** Removes only the current UID from membership without deleting the channel or its messages. */
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

  /** Reuses a deterministic direct conversation or creates it atomically for the specified participants. */
  async openDirect(otherUid: string): Promise<string> {
    const id = directRoomId(this.uid, otherUid),
      reference = doc(this.db, 'conversations', id);
    await runTransaction(this.db, async (transaction) => {
      if ((await transaction.get(reference)).exists()) return;
      transaction.set(reference, this.directData(otherUid));
    });
    return id;
  }

  /** Builds direct-chat metadata with deduplicated, sorted participant UIDs and no channel name. */
  private directData(otherUid: string) {
    return {
      ...this.channelData('', ''),
      kind: 'direct',
      memberIds: [...new Set([this.uid, otherUid])].sort(),
    };
  }
}
