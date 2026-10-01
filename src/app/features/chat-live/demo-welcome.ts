import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { AvatarImage } from '../../shared/ui/avatar-image';

/** Introduces genuinely shared demo channels and fictional contacts without inventing live users. */
@Component({
  selector: 'app-demo-welcome',
  imports: [RouterLink, AvatarImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (channels().length) {
    <section aria-labelledby="demo-heading">
      <h2 id="demo-heading">Willkommen bei DaBubble</h2>
      <p>
        Hier kannst du direkt schreiben, Threads öffnen und reagieren. Demo-Channels sind für alle
        angemeldeten Nutzer und Gäste öffentlich.
      </p>
      <div class="demo-links">
        @for (room of channels(); track room.id) {
          <a class="button secondary" [routerLink]="nav.path(room)"># {{ room.name }}</a>
        }
      </div>
      <p>
        Fiktive Demo-Profile zum Ausprobieren privater Direktnachrichten. Sie antworten nicht
        automatisch.
      </p>
      <div class="demo-links">
        @for (person of people(); track person.uid) {
          <button
            type="button"
            class="demo-person"
            [disabled]="action.busy()"
            (click)="direct(person.uid)"
          >
            <app-avatar-image [index]="person.avatarId" [size]="48" />{{ person.name }}
          </button>
        }
      </div>
      @if (action.error()) {
        <p role="alert">{{ action.error() }}</p>
      }
    </section>
  }`,
  styles: `
    section {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    h2 {
      font-size: 24px;
      margin: 0 0 16px;
    }
    p {
      font-size: 16px;
      margin: 16px 0;
    }
    .demo-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .demo-person {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border: 0;
      border-radius: 24px;
      background: var(--page);
    }
    a {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  `,
})
export class DemoWelcome {
  private readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  protected readonly action = new ChatAction();
  protected readonly channels = computed(() =>
    this.store.channels().filter((room) => room.publicDemo),
  );
  protected readonly people = computed(() => this.store.people().filter((person) => person.demo));

  /** Creates a private conversation owned by the visitor; fictional contacts never impersonate a reply. */
  protected direct(uid: string): void {
    void this.action.run(() => this.nav.direct(uid));
  }
}
