import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { directRoomId } from '../../core/chat/chat-models';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { OverlayState } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';
import { AvatarImage } from '../../shared/ui/avatar-image';

/** Lists only available real conversations and directory identities with active-route and presence feedback. */
@Component({
  selector: 'app-live-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, AvatarImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav aria-label="Arbeitsbereich">
    <div class="workspace-title">
      <img src="assets/images/original/devspace.webp" width="60" height="60" alt="" />
      <h2>Devspace</h2>
      <a class="icon-button" routerLink="/chat/neue-nachricht" aria-label="Neue Nachricht"
        ><app-icon name="compose"
      /></a>
    </div>
    <section class="group">
      <div class="group-heading">
        <button
          class="group-toggle"
          type="button"
          (click)="channelsOpen.set(!channelsOpen())"
          [attr.aria-expanded]="channelsOpen()"
          aria-controls="live-channels"
        >
          <app-icon name="chevron" [class.collapsed]="!channelsOpen()" /><app-icon
            name="channels"
          />Channels
        </button>
        <button class="icon-button" type="button" aria-label="Channel erstellen" (click)="create()">
          <app-icon name="plus" />
        </button>
      </div>
      <ul id="live-channels" [class.folded]="!channelsOpen()">
        @for (room of store.channels(); track room.id) {
          <li>
            <a [routerLink]="nav.path(room)" routerLinkActive="active" ariaCurrentWhenActive="page"
              ><app-icon name="hash" /><span
                >{{ room.name }}{{ room.publicDemo ? ' · Demo' : '' }}</span
              ></a
            >
          </li>
        }
      </ul>
      <button class="add-channel" type="button" (click)="create()">
        <app-icon name="plus" />Channel hinzufügen
      </button>
    </section>
    <section class="group direct-group">
      <button
        class="group-toggle"
        type="button"
        (click)="directOpen.set(!directOpen())"
        [attr.aria-expanded]="directOpen()"
        aria-controls="live-direct"
      >
        <app-icon name="chevron" [class.collapsed]="!directOpen()" /><app-icon
          name="message"
        />Direktnachrichten
      </button>
      <ul id="live-direct" [class.folded]="!directOpen()">
        @for (person of store.people(); track person.uid) {
          <li>
            <button
              type="button"
              class="direct-person"
              [class.active]="active(person.uid)"
              [attr.aria-current]="active(person.uid) ? 'page' : null"
              [attr.data-person-id]="person.uid"
              [disabled]="action.busy()"
              [attr.aria-description]="store.session.presence.label(person.uid)"
              (click)="direct(person.uid)"
            >
              <app-avatar-image
                [index]="person.avatarId"
                [uid]="person.demo ? null : person.uid"
                [size]="50"
              />
              <span
                >{{ person.name
                }}{{ person.uid === store.session.user()?.uid ? ' (Du)' : '' }}</span
              >
            </button>
          </li>
        }
        @for (room of archives(); track room.id) {
          <li>
            <a [routerLink]="nav.path(room)" routerLinkActive="active">{{ store.label(room) }}</a>
          </li>
        }
      </ul>
      <a class="add-channel" routerLink="/chat/neue-nachricht"
        ><app-icon name="compose" />Neue Nachricht</a
      >
    </section>
    @if (action.error()) {
      <p class="action-error" role="alert">{{ action.error() }}</p>
    }
  </nav>`,
  styleUrls: ['../chat/workspace-sidebar.scss', './live-sidebar.scss'],
  styles: 'ul { max-height: none; } ul.folded { max-height: 0; }',
})
export class LiveSidebar {
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  private readonly overlay = inject(OverlayState);
  protected readonly channelsOpen = signal(true);
  protected readonly directOpen = signal(true);
  protected readonly action = new ChatAction();
  protected readonly archives = computed(() =>
    this.store.rooms().filter((room) => room.kind === 'direct' && room.archived),
  );

  /** Matches the deterministic direct route without creating a conversation during rendering. */
  protected active(uid: string): boolean {
    return this.nav.roomId() === directRoomId(this.store.session.user()?.uid ?? '', uid);
  }

  /** Creates or reuses the selected person's private conversation and exposes actionable failures. */
  protected direct(uid: string): void {
    void this.action.run(() => this.nav.direct(uid));
  }

  /** Opens channel creation in real persistence mode rather than the design preview. */
  protected create(): void {
    this.overlay.open('channel-create', { live: true });
  }
}
