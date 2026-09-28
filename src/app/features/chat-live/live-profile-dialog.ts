import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { OverlayState } from '../../core/ui/overlay-state';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { ProfileDraftState } from '../../core/auth/profile-draft';
import { PresenceLabel } from '../../shared/ui/presence-label';

/** Presents real directory identity with own-profile editing and protected direct-chat navigation. */
@Component({
  selector: 'app-live-profile-dialog',
  imports: [AvatarImage, Icon, PresenceLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-avatar-image class="profile-avatar" [index]="person().avatarId" [size]="200" />
    <div class="name-row">
      <h3 class="profile-name">{{ person().name }}</h3>
      @if (own()) {
        <button class="text-button profile-edit-button" type="button" (click)="edit()">
          <span>Bearbeiten</span><app-icon name="pencil" />
        </button>
      }
    </div>
    <app-presence-label class="presence" [uid]="person().uid" />
    <div class="email">
      <h4><app-icon name="mail" />E-Mail-Adresse</h4>
      @if (own()) {
        <p>{{ store.session.user()?.email ?? 'Keine E-Mail-Adresse (Gastkonto)' }}</p>
      } @else {
        <p class="private-email">Nicht freigegeben</p>
      }
    </div>
    @if (!own()) {
      <div class="actions">
        <button class="button" type="button" [disabled]="action.busy()" (click)="direct()">
          <app-icon name="message" />{{ action.busy() ? 'Wird geöffnet…' : 'Nachricht' }}
        </button>
      </div>
    }
    @if (action.error()) {
      <p class="action-error" role="alert">{{ action.error() }}</p>
    }`,
  styleUrl: '../overlays/profile-panel.scss',
})
export class LiveProfileDialog {
  protected readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  private readonly nav = inject(ChatNavigation);
  private readonly draft = inject(ProfileDraftState);
  protected readonly action = new ChatAction();
  protected readonly person = computed(() =>
    this.store.person(this.overlay.current()?.personId ?? ''),
  );
  protected readonly own = computed(() => this.person().uid === this.store.session.user()?.uid);

  /** Seeds the shared edit draft from the displayed profile before opening the own-account editor. */
  protected edit(): void {
    this.draft.begin(this.person().name, this.person().avatarId);
    this.overlay.open('profile-edit', { account: true });
  }

  /** Opens the participant's persisted direct conversation before dismissing the profile dialog. */
  protected direct(): void {
    void this.action.run(async () => {
      await this.nav.direct(this.person().uid);
      if (this.overlay.current()) this.overlay.close();
    });
  }
}
