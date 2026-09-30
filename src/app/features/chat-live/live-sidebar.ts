import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
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
              ><app-icon name="hash" /><span>{{ room.name }}</span></a
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
        @for (room of directs(); track room.id) {
          <li>
            <a
              [routerLink]="nav.path(room)"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [attr.aria-description]="
                room.archived ? null : store.session.presence.label(partner(room.memberIds))
              "
              ><app-avatar-image
                [index]="room.archived ? null : store.person(partner(room.memberIds)).avatarId"
                [uid]="room.archived ? null : partner(room.memberIds)"
                [size]="50"
              /><span>{{ store.label(room) }}</span></a
            >
          </li>
        }
      </ul>
      <a class="add-channel" routerLink="/chat/neue-nachricht"
        ><app-icon name="compose" />Neue Nachricht</a
      >
    </section>
  </nav>`,
  styleUrls: ['../chat/workspace-sidebar.scss'],
  styles: 'ul { max-height: none; } ul.folded { max-height: 0; }',
})
export class LiveSidebar {
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  private readonly overlay = inject(OverlayState);
  protected readonly channelsOpen = signal(true);
  protected readonly directOpen = signal(true);
  protected readonly directs = computed(() =>
    this.store.rooms().filter((room) => room.kind === 'direct'),
  );

  /** Selects the other direct-chat participant, falling back to the sole member for self conversations. */
  protected partner(members: string[]): string {
    return members.find((id) => id !== this.store.session.user()?.uid) ?? members[0] ?? '';
  }

  /** Opens channel creation in real persistence mode rather than the design preview. */
  protected create(): void {
    this.overlay.open('channel-create', { live: true });
  }
}
