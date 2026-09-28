import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { OverlayState } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { LiveComposer } from './live-composer';
import { LiveMessage } from './live-message';

/** Renders live root or thread messages and coordinates room details, day separators and scroll position. */
@Component({
  selector: 'app-live-conversation',
  imports: [DatePipe, Icon, AvatarImage, LiveComposer, LiveMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-conversation.html',
  styleUrls: ['../chat/conversation.scss', './live-conversation.scss'],
})
export class LiveConversation {
  readonly compact = input(false);
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  private readonly overlay = inject(OverlayState);
  private readonly transcript = viewChild<ElementRef<HTMLElement>>('transcript');
  protected readonly room = computed(() =>
    this.store.rooms().find((room) => room.id === this.nav.roomId()),
  );
  protected readonly roots = computed(() => (this.room() ? [this.room()!] : []));
  protected readonly partner = computed(() => {
    const room = this.room();
    const uid = room?.memberIds.find((id) => id !== this.store.session.user()?.uid);
    return this.store.person(uid ?? room?.memberIds[0] ?? '');
  });
  protected readonly selfConversation = computed(
    () => this.room()?.kind === 'direct' && this.room()?.memberIds.length === 1,
  );
  protected readonly root = computed(() => (this.compact() ? this.nav.threadId() : ''));
  private readonly all = computed(() => this.store.messages()[this.nav.roomId()] ?? []);
  protected readonly parent = computed(() =>
    this.all().find((message) => message.id === this.root()),
  );
  protected readonly messages = computed(() =>
    this.all().filter((message) => message.rootId === this.root()),
  );
  private lastRoom = '';
  private lastMessage = '';
  private lastSearch = '';

  /** Adjusts transcript scrolling after reactive message and route changes have rendered. */
  constructor() {
    afterRenderEffect(() => this.scroll());
  }

  /** Opens channel metadata or the direct-chat partner's profile using the current real conversation. */
  protected details(): void {
    const room = this.room();
    if (!room) return;
    this.overlay.open(room.kind === 'channel' ? 'channel' : 'profile', {
      live: true,
      channelId: room.id,
      title: () => this.room()?.name ?? 'Channel',
      personId: this.partner().uid,
    });
  }

  /** Opens the member list scoped to the current persisted conversation. */
  protected members(): void {
    this.overlay.open('members', { live: true, channelId: this.room()?.id });
  }

  /** Adds a day separator when adjacent messages fall on different local calendar dates. */
  protected newDay(index: number): boolean {
    const current = this.messages()[index],
      previous = this.messages()[index - 1];
    return (
      !!current &&
      (!previous ||
        new Date(current.createdAt).toDateString() !== new Date(previous.createdAt).toDateString())
    );
  }

  /** Follows initial or nearby conversation updates while allowing search links to locate a specific message. */
  private scroll(): void {
    const element = this.transcript()?.nativeElement;
    if (!element) return;
    const key = this.nav.roomId() + this.root(),
      last = this.messages().at(-1);
    const initial = this.lastRoom !== key || !this.lastMessage;
    if (initial || this.shouldFollow(element)) element.scrollTop = element.scrollHeight;
    this.lastRoom = key;
    this.lastMessage = last?.id ?? '';
    this.scrollSearch(element);
  }

  /** Follows newly appended messages only when sent by this user or the reader is near the bottom. */
  private shouldFollow(element: HTMLElement): boolean {
    const last = this.messages().at(-1);
    const nearby = element.scrollHeight - element.scrollTop - element.clientHeight < 180;
    return (
      last?.id !== this.lastMessage && (last?.authorId === this.store.session.user()?.uid || nearby)
    );
  }

  /** Centers and focuses a linked search result once its message has rendered. */
  private scrollSearch(element: HTMLElement): void {
    const id = String(this.nav.tree().queryParams['message'] ?? '');
    if (!id || id === this.lastSearch) return;
    const target = element.querySelector<HTMLElement>('[data-message-id="' + CSS.escape(id) + '"]');
    if (!target) return;
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
    this.lastSearch = id;
  }
}
