import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-live-search',
  imports: [AvatarImage, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="sr-only" [for]="fieldId()">{{
      recipient() ? 'Empfänger' : 'Devspace durchsuchen'
    }}</label>
    <input
      [id]="fieldId()"
      type="search"
      autocomplete="off"
      [value]="query()"
      [placeholder]="recipient() ? 'An: #channel oder @Name' : 'Devspace durchsuchen'"
      (input)="query.set($any($event.target).value)"
      (keydown.escape)="query.set('')"
    />
    @if (!recipient()) {
      <app-icon class="search-icon" name="search" />
    }
    @if (query().trim()) {
      <div class="results" aria-label="Suchergebnisse">
        @for (room of channels(); track room.id) {
          <a [routerLink]="nav.path(room)" (click)="query.set('')"># {{ room.name }}</a>
        }
        @for (person of people(); track person.uid) {
          <button type="button" [disabled]="action.busy()" (click)="direct(person.uid)">
            <app-avatar-image [index]="person.avatarId" [size]="40" />{{ person.name }}
          </button>
        }
        @for (result of messages(); track result.message.id) {
          <button type="button" (click)="openMessage(result)">
            <span
              ><strong>{{ store.label(result.room) }}</strong
              ><br />{{ result.message.text }}</span
            >
          </button>
        }
        @if (!channels().length && !people().length && !messages().length) {
          <p>Keine Treffer.</p>
        }
        @if (action.error()) {
          <p role="alert">{{ action.error() }}</p>
        }
      </div>
    }
  `,
  styleUrl: './live-search.scss',
})
export class LiveSearch {
  readonly recipient = input(false);
  readonly fieldId = input('live-search');
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
    this.recipient() || /^[@#]/.test(this.query())
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
