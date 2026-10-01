import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { decodeMessage } from '../../core/chat/message-mentions';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { MobileNavigation } from '../../core/ui/mobile-navigation';

/** Searches subscribed conversation data and directory entries with desktop and history-backed mobile presentation. */
@Component({
  selector: 'app-live-search',
  imports: [AvatarImage, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-search.html',
  styleUrl: './live-search.scss',
  host: { '(document:pointerdown)': 'outside($event)', '(document:focusin)': 'outside($event)' },
})
export class LiveSearch {
  readonly recipient = input(false);
  readonly fieldId = input('live-search');
  readonly mobileMenu = input(false);
  protected readonly mobile = inject(MobileNavigation);
  protected readonly mobileExpanded = computed(
    () => this.mobileMenu() && this.mobile.view() === 'search',
  );
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly opened = signal(false);
  protected readonly visible = computed(
    () => this.opened() && (!!this.query().trim() || this.mobileExpanded()),
  );
  private wasMobileExpanded = false;
  private restoringFocus = false;
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  protected readonly action = new ChatAction();
  protected readonly query = signal('');
  private readonly term = computed(() =>
    this.query().trim().replace(/^[@#]/, '').toLocaleLowerCase(),
  );
  protected readonly channels = computed(() =>
    this.query().startsWith('@')
      ? []
      : this.store.channels().filter((room) => room.name.toLocaleLowerCase().includes(this.term())),
  );
  protected readonly people = computed(() =>
    this.query().startsWith('#')
      ? []
      : this.store
          .people()
          .filter((person) => person.name.toLocaleLowerCase().includes(this.term())),
  );
  protected readonly messages = computed(() =>
    this.recipient() || !this.term() || /^[@#]/.test(this.query())
      ? []
      : this.store
          .rooms()
          .flatMap((room) =>
            (this.store.messages()[room.id] ?? [])
              .filter(
                (message) =>
                  !message.deleted &&
                  decodeMessage(message.text).text.toLocaleLowerCase().includes(this.term()),
              )
              .map((message) => ({ room, message, text: decodeMessage(message.text).text })),
          ),
  );

  /** Restores focus when the expanded mobile search view is dismissed after rendering. */
  constructor() {
    afterRenderEffect(() => this.restoreSearchFocus());
  }

  /** Dismisses a closing mobile search without deleting its query or reopening it through restored focus. */
  private restoreSearchFocus(): void {
    const expanded = this.mobileExpanded();
    if (!expanded && this.wasMobileExpanded) {
      this.opened.set(false);
      const field = this.field().nativeElement;
      this.restoringFocus = true;
      if (field.checkVisibility()) field.focus({ preventScroll: true });
      this.restoringFocus = false;
    }
    this.wasMobileExpanded = expanded;
  }

  /** Updates live filtering and opens the dedicated mobile search view when typing from the menu. */
  protected changeQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.opened.set(true);
    if (this.mobileMenu() && this.mobile.isMobile()) this.mobile.open('search');
  }

  /** Moves keyboard focus into the first enabled result without performing a selection. */
  protected focusResult(event: Event): void {
    event.preventDefault();
    this.opened.set(true);
    requestAnimationFrame(() =>
      this.results()?.nativeElement.querySelector<HTMLElement>('a, button:not(:disabled)')?.focus(),
    );
  }

  /** Moves between available results while leaving selection to Enter or a pointer action. */
  protected moveResult(event: Event, direction: number): void {
    event.preventDefault();
    const items = Array.from(
      this.results()?.nativeElement.querySelectorAll<HTMLElement>('a, button:not(:disabled)') ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    items[(current + direction + items.length) % items.length]?.focus();
  }

  /** Prevents native search-field clearing on Escape and closes results while preserving the query. */
  protected dismiss(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.mobileExpanded()) this.mobile.close();
    else this.field().nativeElement.focus({ preventScroll: true });
    this.opened.set(false);
  }

  /** Dismisses only external pointer or focus movement, preserving the query and internal result actions. */
  protected outside(event: Event): void {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.opened.set(false);
      const navigating =
        event.target instanceof Element &&
        event.target.closest('a[href], [aria-haspopup="dialog"]');
      if (this.mobileExpanded() && !navigating) this.mobile.close();
    }
  }

  /** Reopens preserved search results, including the dedicated mobile presentation. */
  protected focus(): void {
    if (this.restoringFocus) return;
    this.opened.set(true);
    if (this.query().trim() && this.mobileMenu() && this.mobile.isMobile())
      this.mobile.open('search');
  }

  /** Clears the query only after opening a real direct conversation with the selected member. */
  protected direct(uid: string): void {
    void this.action.run(async () => {
      await this.nav.direct(uid);
      this.query.set('');
    });
  }

  /** Opens the result's conversation and thread context before clearing the search query. */
  protected openMessage(result: ReturnType<typeof this.messages>[number]): void {
    this.nav.message(result.room, result.message.id, result.message.rootId);
    this.query.set('');
  }
}
