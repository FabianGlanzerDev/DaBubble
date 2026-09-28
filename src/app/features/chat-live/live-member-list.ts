import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatRoom } from '../../core/chat/chat-models';
import { OverlayState } from '../../core/ui/overlay-state';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-live-member-list',
  imports: [AvatarImage, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ul class="members-list">
      @for (id of room().memberIds; track id) {
        <li>
          <button
            type="button"
            (click)="profile(id)"
            [attr.aria-description]="store.session.presence.label(id)"
          >
            <app-avatar-image [index]="store.person(id).avatarId" [size]="50" [uid]="id" />
            <span
              >{{ store.person(id).name
              }}{{ id === store.session.user()?.uid ? ' (Du)' : '' }}</span
            >
          </button>
        </li>
      }
    </ul>
    <button class="add-members" type="button" (click)="add()">
      <app-icon name="user-add" /><span>Mitglieder hinzufügen</span>
    </button>`,
  styleUrl: '../overlays/members-panel.scss',
})
export class LiveMemberList {
  readonly room = input.required<ChatRoom>();
  protected readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);

  protected profile(uid: string): void {
    const own = uid === this.store.session.user()?.uid;
    this.overlay.open('profile', { live: !own, account: own, personId: uid });
  }

  protected add(): void {
    this.overlay.open('add-members', { live: true, channelId: this.room().id });
  }
}
