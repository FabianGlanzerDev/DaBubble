import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthNote } from '../../shared/ui/auth-note';
import { PublicLayout } from '../../shared/layout/public-layout';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { RegistrationPreview } from './registration-preview';
import { AuthSession } from '../../core/auth/auth-session';
import { authIssue } from '../../core/auth/auth-errors';
import { FormField } from '../../shared/ui/form-field';
import { SuccessOverlay } from '../../shared/ui/success-overlay';
import { validProfileDraft } from '../../core/auth/user-profile';

/** Restores account-bound avatar setup and separates real profile persistence from the design preview. */
@Component({
  selector: 'app-avatar-page',
  imports: [AuthNote, PublicLayout, RouterLink, AvatarImage, Icon, FormField, SuccessOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar-page.html',
  styleUrl: './avatar-page.scss',
})
export class AvatarPage {
  protected readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  protected readonly realAccount = !!inject(ActivatedRoute).snapshot.data['account'];
  private readonly draft = this.realAccount
    ? this.session.registration.forUser(this.session.user())
    : null;
  protected readonly name = signal(
    this.draft?.name ??
      this.session.profile()?.name ??
      (this.session.pendingName() || this.session.user()?.displayName?.slice(0, 80) || ''),
  );
  protected readonly needsName =
    this.realAccount && (!this.name() || this.session.user()?.providerIds.includes('google.com'));
  protected readonly error = signal('');
  protected readonly completed = signal(!!this.draft?.completed && !!this.session.profile());
  protected readonly registration = inject(RegistrationPreview);
  protected readonly avatars = [0, 1, 2, 3, 4, 5] as const;
  protected readonly selection = signal<number | null>(
    this.realAccount ? (this.draft?.avatarId ?? this.session.profile()?.avatarId ?? null) : null,
  );
  protected readonly backRoute = this.draft
    ? '/registrierung'
    : this.realAccount
      ? '/anmeldung'
      : '/registrierung';
  protected readonly valid = computed(
    () =>
      this.selection() !== null &&
      validProfileDraft({ name: this.name(), avatarId: this.selection()! }),
  );

  /** Persists real-account avatar progress before reflecting the choice so reloads do not lose setup state. */
  protected select(avatarId: number): void {
    this.error.set('');
    try {
      if (this.realAccount)
        this.session.registration.update(this.session.user(), this.name(), avatarId);
      this.selection.set(avatarId);
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }

  /** Saves a valid profile before completing registration or navigating an existing account to chat. */
  protected async save(): Promise<void> {
    if (!this.realAccount || !this.valid() || this.session.busy() || this.completed()) return;
    this.error.set('');
    try {
      await this.session.saveProfile({ name: this.name(), avatarId: this.selection()! });
      this.session.registration.complete(this.session.user());
      if (this.destroy.destroyed) return;
      if (this.draft) this.completed.set(true);
      else await this.router.navigateByUrl('/chat');
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }

  /** Clears completed signup progress only after successful navigation from the confirmation to chat. */
  protected async finish(): Promise<void> {
    if (this.destroy.destroyed) return;
    if (await this.router.navigateByUrl('/chat', { replaceUrl: true }))
      this.session.registration.clear();
  }
}
