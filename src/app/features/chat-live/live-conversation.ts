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

  constructor() {
    afterRenderEffect(() => this.scroll());
  }

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

  protected members(): void {
    this.overlay.open('members', { live: true, channelId: this.room()?.id });
  }

  protected newDay(index: number): boolean {
    const current = this.messages()[index],
      previous = this.messages()[index - 1];
    return (
      !!current &&
      (!previous ||
        new Date(current.createdAt).toDateString() !== new Date(previous.createdAt).toDateString())
    );
  }

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

  private shouldFollow(element: HTMLElement): boolean {
    const last = this.messages().at(-1);
    const nearby = element.scrollHeight - element.scrollTop - element.clientHeight < 180;
    return (
      last?.id !== this.lastMessage && (last?.authorId === this.store.session.user()?.uid || nearby)
    );
  }

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
