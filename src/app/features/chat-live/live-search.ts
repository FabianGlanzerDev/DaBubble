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
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { MobileNavigation } from '../../core/ui/mobile-navigation';

@Component({
  selector: 'app-live-search',
  imports: [AvatarImage, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-search.html',
  styleUrl: './live-search.scss',
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
  private wasMobileExpanded = false;
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
                  !message.deleted && message.text.toLocaleLowerCase().includes(this.term()),
              )
              .map((message) => ({ room, message })),
          ),
  );

  constructor() {
    afterRenderEffect(() => this.restoreSearchFocus());
  }

  private restoreSearchFocus(): void {
    const expanded = this.mobileExpanded();
    if (!expanded && this.wasMobileExpanded) {
      this.query.set('');
      const field = this.field().nativeElement;
      if (field.checkVisibility()) field.focus({ preventScroll: true });
    }
    this.wasMobileExpanded = expanded;
  }

  protected changeQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    if (this.mobileMenu() && this.mobile.isMobile()) this.mobile.open('search');
  }

  protected focusResult(event: Event): void {
    event.preventDefault();
    this.results()?.nativeElement.querySelector<HTMLElement>('a, button:not(:disabled)')?.focus();
  }

  protected dismiss(): void {
    this.query.set('');
    if (this.mobileExpanded()) this.mobile.close();
    else this.field().nativeElement.focus({ preventScroll: true });
  }

  protected direct(uid: string): void {
    void this.action.run(async () => {
      await this.nav.direct(uid);
      this.query.set('');
    });
  }

  protected openMessage(result: ReturnType<typeof this.messages>[number]): void {
    this.nav.message(result.room, result.message.id, result.message.rootId);
    this.query.set('');
  }
}
