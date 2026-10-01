import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthSession } from '../auth/auth-session';
import { ChatMessage, ChatPerson, ChatReaction, ChatRoom, chatError } from './chat-models';
import type { ChatApi } from './chat-api';

/** Maintains account-scoped live chat subscriptions, cached messages and recent reaction choices. */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  readonly session = inject(AuthSession);
  private readonly accountUid = computed(() =>
    this.session.pending() === 'logout' ? undefined : this.session.user()?.uid,
  );
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

  /** Rebinds chat listeners on account changes and republishes profile edits to the directory. */
  constructor() {
    effect(() => {
      const uid = this.accountUid();
      untracked(() => this.connect(uid));
    });
    effect(() => this.publish(this.session.profile()));
    this.destroy.onDestroy(() => this.disconnect());
  }

  /** Clears the previous account's cached data before starting a new authenticated subscription set. */
  private connect(uid?: string): void {
    this.disconnect();
    if (uid) void this.initialize(uid, this.revision);
    else this.loading.set(false);
  }

  /** Creates the chat client and directory entry only while the initiating account revision is current. */
  private async initialize(uid: string, revision: number): Promise<void> {
    try {
      const chatModule = await import('./chat-api');
      const database = await this.session.chatDatabase();
      if (revision !== this.revision) return;
      this.client = new chatModule.ChatApi(database, uid);
      const profile = this.session.profile();
      if (profile) await this.client.publishPerson(profile);
      if (revision === this.revision) this.subscribe(revision);
    } catch (error) {
      if (revision === this.revision) this.fail(error);
    }
  }

  /** Starts directory and membership listeners whose errors are scoped to this connection revision. */
  private subscribe(revision: number): void {
    /** Ignores delayed subscription errors from an account connection that has already been replaced. */
    const fail = (error: unknown) => {
      if (revision === this.revision) this.fail(error);
    };
    this.stops.push(this.api().people((people) => this.acceptPeople(people), fail));
    this.stops.push(this.api().rooms((rooms) => this.acceptRooms(rooms), fail));
  }

  /** Sorts directory entries and synchronizes the UIDs observed by the presence service. */
  private acceptPeople(people: ChatPerson[]): void {
    this.people.set(people.sort((a, b) => a.name.localeCompare(b.name)));
    this.session.watchPresence(people.filter((person) => !person.demo).map((person) => person.uid));
  }

  /** Drops revoked conversations and attaches listeners to newly permitted rooms before ending loading. */
  private acceptRooms(rooms: ChatRoom[]): void {
    for (const [id, stops] of this.roomStops) {
      if (!rooms.some((room) => room.id === id)) this.dropRoom(id, stops);
    }
    this.rooms.set(rooms.sort((a, b) => a.name.localeCompare(b.name)));
    for (const room of rooms) if (!this.roomStops.has(room.id)) this.watchRoom(room.id);
    this.loading.set(false);
  }

  /** Maintains separate message and reaction streams for an accessible conversation. */
  private watchRoom(id: string): void {
    /** Replaces this conversation's message cache without disturbing other subscribed rooms. */
    const messages = (items: ChatMessage[]) =>
      this.messages.update((all) => ({ ...all, [id]: items }));

    /** Replaces this conversation's reaction cache without disturbing other subscribed rooms. */
    const reactions = (items: ChatReaction[]) =>
      this.reactions.update((all) => ({ ...all, [id]: items }));
    this.roomStops.set(id, [
      this.api().messages(id, messages, (error) => this.failRoom(id, error)),
      this.api().reactions(id, reactions, (error) => this.failRoom(id, error)),
    ]);
  }

  /** Ignores late listener failures from conversations whose membership has already been revoked. */
  private failRoom(id: string, error: unknown): void {
    if (this.rooms().some((room) => room.id === id)) this.fail(error);
  }

  /** Unsubscribes a revoked room and removes its messages and reactions from local state. */
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

  /** Propagates profile changes to the directory and ignores errors from superseded account connections. */
  private publish(profile: ChatPerson | null): void {
    if (!profile || !this.client) return;
    const revision = this.revision;
    void this.client.publishPerson(profile).catch((error: unknown) => {
      if (revision === this.revision) this.fail(error);
    });
  }

  /** Disposes all listeners and account-specific caches before another user can access the workspace. */
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

  /** Stops loading and exposes safe feedback for a failed chat connection. */
  private fail(error: unknown): void {
    this.error.set(chatError(error));
    this.loading.set(false);
  }

  /** Rebuilds subscriptions for the current session after a recoverable loading failure. */
  retry(): void {
    this.connect(this.session.user()?.uid);
  }

  /** Rejects writes before client initialization or when the browser reports an offline connection. */
  private api(): ChatApi {
    if (!this.client) throw new Error('chat-not-ready');
    if (!navigator.onLine) throw new Error('offline');
    return this.client;
  }

  /** Resolves directory identity with distinct fallbacks for deleted accounts and unavailable members. */
  person(uid: string): ChatPerson {
    if (!uid) return { uid: '', name: 'Gelöschtes Konto', avatarId: 0 };
    return (
      this.people().find((person) => person.uid === uid) ?? { uid, name: 'Mitglied', avatarId: 0 }
    );
  }

  /** Derives a room title from channel metadata, direct-chat participants or its archive state. */
  label(room: ChatRoom): string {
    if (room.archived) return 'Direktgespräch · Konto gelöscht';
    const uid =
      room.memberIds.find((id) => id !== this.session.user()?.uid) ?? room.memberIds[0] ?? '';
    return room.kind === 'channel' ? room.name : this.person(uid).name;
  }

  /** Creates a validated channel through the ready, connectivity-checked chat client. */
  create(name: string, description: string): Promise<string> {
    return this.api().createChannel(name, description);
  }

  /** Adds selected members sequentially; already completed additions remain if a later addition fails. */
  async invite(id: string, members: string[]): Promise<void> {
    const client = this.api();
    for (const member of members) await client.addMember(id, member);
  }

  /** Delegates validated channel metadata changes to the authenticated transactional API. */
  editRoom(room: ChatRoom, name: string, description: string): Promise<void> {
    return this.api().editChannel(room, name, description);
  }

  /** Stops room listeners before leaving and reinstates them if the membership update fails. */
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

  /** Returns the existing or newly created deterministic conversation for the selected UID. */
  direct(uid: string): Promise<string> {
    return this.api().openDirect(uid);
  }

  /** Sends a root message or reply through the currently authenticated chat client. */
  send(id: string, text: string, root = ''): Promise<void> {
    return this.api().send(id, text, root);
  }

  /** Updates message content through the server's author-ownership checks. */
  edit(message: ChatMessage, text: string): Promise<void> {
    return this.api().edit(message, text);
  }

  /** Requests message tombstoning rather than deleting shared thread structure. */
  remove(message: ChatMessage): Promise<void> {
    return this.api().remove(message);
  }

  /** Persists an emoji toggle before updating the two most recent reaction shortcuts. */
  async react(message: ChatMessage, emoji: string): Promise<void> {
    await this.api().react(message, emoji);
    this.recent.update((recent) => [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 2));
  }
}
