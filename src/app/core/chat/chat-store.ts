import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthSession } from '../auth/auth-session';
import { ChatMessage, ChatPerson, ChatReaction, ChatRoom, chatError } from './chat-models';
import type { ChatApi } from './chat-api';

@Injectable({ providedIn: 'root' })
export class ChatStore {
  readonly session = inject(AuthSession);
  private readonly accountUid = computed(() => this.session.user()?.uid);
  private readonly destroy = inject(DestroyRef);
  private client: ChatApi | null = null;
  private revision = 0;
  private stops: (() => void)[] = [];
  private roomStops = new Map<string, (() => void)[]>();
  readonly people = signal<ChatPerson[]>([]);
  readonly rooms = signal<ChatRoom[]>([]);
  readonly messages = signal<Record<string, ChatMessage[]>>({});
  readonly reactions = signal<Record<string, ChatReaction[]>>({});
  readonly error = signal('');
  readonly loading = signal(true);
  readonly channels = computed(() =>
    this.rooms()
      .filter((room) => room.kind === 'channel')
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id)),
  );
  readonly recent = signal<string[]>(['✅', '🙌']);

  constructor() {
    effect(() => {
      const uid = this.accountUid();
      untracked(() => this.connect(uid));
    });
    effect(() => this.publish(this.session.profile()));
    this.destroy.onDestroy(() => this.disconnect());
  }

  private connect(uid?: string): void {
    this.disconnect();
    if (uid) void this.initialize(uid, this.revision);
    else this.loading.set(false);
  }

  private async initialize(uid: string, revision: number): Promise<void> {
    try {
      const { ChatApi } = await import('./chat-api');
      const database = await this.session.chatDatabase();
      if (revision !== this.revision) return;
      this.client = new ChatApi(database, uid);
      const profile = this.session.profile();
      if (profile) await this.client.publishPerson(profile);
      if (revision === this.revision) this.subscribe(revision);
    } catch (error) {
      if (revision === this.revision) this.fail(error);
    }
  }

  private subscribe(revision: number): void {
    const fail = (error: unknown) => {
      if (revision === this.revision) this.fail(error);
    };
    this.stops.push(this.api().people((people) => this.acceptPeople(people), fail));
    this.stops.push(this.api().rooms((rooms) => this.acceptRooms(rooms), fail));
  }

  private acceptPeople(people: ChatPerson[]): void {
    this.people.set(people.sort((a, b) => a.name.localeCompare(b.name)));
    this.session.watchPresence(people.map((person) => person.uid));
  }

  private acceptRooms(rooms: ChatRoom[]): void {
    for (const [id, stops] of this.roomStops) {
      if (!rooms.some((room) => room.id === id)) this.dropRoom(id, stops);
    }
    this.rooms.set(rooms.sort((a, b) => a.name.localeCompare(b.name)));
    for (const room of rooms) if (!this.roomStops.has(room.id)) this.watchRoom(room.id);
    this.loading.set(false);
  }

  private watchRoom(id: string): void {
    const fail = (error: unknown) => {
      if (this.rooms().some((room) => room.id === id)) this.fail(error);
    };
    const messages = (items: ChatMessage[]) =>
      this.messages.update((all) => ({ ...all, [id]: items }));
    const reactions = (items: ChatReaction[]) =>
      this.reactions.update((all) => ({ ...all, [id]: items }));
    this.roomStops.set(id, [
      this.api().messages(id, messages, fail),
      this.api().reactions(id, reactions, fail),
    ]);
  }

  private dropRoom(id: string, stops: (() => void)[]): void {
    stops.forEach((stop) => stop());
    this.roomStops.delete(id);
    this.messages.update((all) =>
      Object.fromEntries(Object.entries(all).filter(([key]) => key !== id)),
    );
    this.reactions.update((all) =>
      Object.fromEntries(Object.entries(all).filter(([key]) => key !== id)),
    );
  }

  private publish(profile: ChatPerson | null): void {
    if (!profile || !this.client) return;
    const revision = this.revision;
    void this.client.publishPerson(profile).catch((error: unknown) => {
      if (revision === this.revision) this.fail(error);
    });
  }

  private disconnect(): void {
    this.revision++;
    this.stops.splice(0).forEach((stop) => stop());
    this.roomStops.forEach((stops) => stops.forEach((stop) => stop()));
    this.roomStops.clear();
    this.client = null;
    this.acceptPeople([]);
    this.rooms.set([]);
    this.messages.set({});
    this.reactions.set({});
    this.error.set('');
    this.loading.set(true);
    this.recent.set(['✅', '🙌']);
  }

  private fail(error: unknown): void {
    this.error.set(chatError(error));
    this.loading.set(false);
  }

  retry(): void {
    this.connect(this.session.user()?.uid);
  }

  private api(): ChatApi {
    if (!this.client) throw new Error('chat-not-ready');
    if (!navigator.onLine) throw new Error('offline');
    return this.client;
  }

  person(uid: string): ChatPerson {
    if (!uid) return { uid: '', name: 'Gelöschtes Konto', avatarId: 0 };
    return (
      this.people().find((person) => person.uid === uid) ?? { uid, name: 'Mitglied', avatarId: 0 }
    );
  }

  label(room: ChatRoom): string {
    if (room.archived) return 'Direktgespräch · Konto gelöscht';
    const uid =
      room.memberIds.find((id) => id !== this.session.user()?.uid) ?? room.memberIds[0] ?? '';
    return room.kind === 'channel' ? room.name : this.person(uid).name;
  }

  create(name: string, description: string): Promise<string> {
    return this.api().createChannel(name, description);
  }

  async invite(id: string, members: string[]): Promise<void> {
    const client = this.api();
    for (const member of members) await client.addMember(id, member);
  }

  editRoom(room: ChatRoom, name: string, description: string): Promise<void> {
    return this.api().editChannel(room, name, description);
  }

  async leave(id: string): Promise<void> {
    const stops = this.roomStops.get(id);
    if (stops) this.dropRoom(id, stops);
    try {
      await this.api().leaveChannel(id);
    } catch (error) {
      this.watchRoom(id);
      throw error;
    }
  }

  direct(uid: string): Promise<string> {
    return this.api().openDirect(uid);
  }

  send(id: string, text: string, root = ''): Promise<void> {
    return this.api().send(id, text, root);
  }

  edit(message: ChatMessage, text: string): Promise<void> {
    return this.api().edit(message, text);
  }

  remove(message: ChatMessage): Promise<void> {
    return this.api().remove(message);
  }

  async react(message: ChatMessage, emoji: string): Promise<void> {
    await this.api().react(message, emoji);
    this.recent.update((recent) => [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 2));
  }
}
