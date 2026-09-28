import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverlayState } from '../../core/ui/overlay-state';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { findPerson } from '../chat/workspace-people';
import { AuthSession } from '../../core/auth/auth-session';
import { ProfileDraftState } from '../../core/auth/profile-draft';
import { authIssue } from '../../core/auth/auth-errors';
import { PresenceLabel } from '../../shared/ui/presence-label';

/** Shares profile and avatar presentation while restricting persistence to the real own-account editor. */
@Component({
  selector: 'app-profile-panel',
  imports: [RouterLink, AvatarImage, Icon, PresenceLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-panel.html',
  styleUrl: './profile-panel.scss',
})
export class ProfilePanel {
  protected readonly session = inject(AuthSession);
  protected readonly draft = inject(ProfileDraftState);
  protected readonly realAccount = computed(() => !!this.overlay.current()?.account);
  protected readonly overlay = inject(OverlayState);
  protected readonly person = computed(() =>
    this.realAccount()
      ? {
          id: this.session.user()?.uid ?? '',
          name: this.session.profile()?.name ?? '',
          avatar: this.session.profile()?.avatarId ?? 0,
          email: this.session.user()?.email ?? 'Keine E-Mail-Adresse (Gastkonto)',
          away: false,
        }
      : findPerson(this.overlay.current()?.personId),
  );
  protected readonly own = computed(
    () => this.realAccount() || this.person().id === 'frederik-beck',
  );
  protected readonly editing = computed(() => this.overlay.current()?.type === 'profile-edit');
  protected readonly avatarMode = computed(() => this.overlay.current()?.type === 'avatar');
  protected readonly draftName = this.draft.name;
  protected readonly draftAvatar = this.draft.avatar;
  protected readonly error = signal('');
  protected readonly nameError = computed(() =>
    !this.draftName().trim()
      ? 'Bitte gib einen Namen ein.'
      : this.draftName().trim().length > 80
        ? 'Der Name darf höchstens 80 Zeichen lang sein.'
        : '',
  );
  protected readonly avatars = [0, 1, 2, 3, 4, 5];

  /** Seeds a fresh profile draft unless returning from the avatar step, where unsaved choices must remain. */
  protected openEdit(): void {
    if (!this.avatarMode()) this.draft.begin(this.person().name, this.person().avatar);
    this.open('profile-edit');
  }

  /** Updates the shared unsaved name draft so it survives transitions between profile dialogs. */
  protected updateName(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  /** Carries the selected identity and real-account flag through profile, edit and avatar dialogs. */
  protected open(type: 'profile' | 'profile-edit' | 'avatar'): void {
    this.overlay.open(type, { personId: this.person().id, account: this.realAccount() });
  }

  /** Persists valid own-account changes and returns to profile only if the initiating dialog is still open. */
  protected async save(): Promise<void> {
    if (!this.realAccount() || this.nameError() || this.session.busy()) return;
    this.error.set('');
    const context = this.overlay.current();
    try {
      await this.session.saveProfile({ name: this.draftName(), avatarId: this.draftAvatar() });
      if (this.overlay.current() === context && !this.overlay.closing()) this.open('profile');
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }
}
