import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { authIssue } from '../../core/auth/auth-errors';
import { PublicLayout } from '../../shared/layout/public-layout';
import { Icon } from '../../shared/ui/icon';

/** Explains Google authentication and requires explicit consent before linking an active guest identity. */
@Component({
  selector: 'app-access-page',
  imports: [PublicLayout, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-page.html',
  styleUrls: ['./auth-page.scss', './access-page.scss'],
})
export class AccessPage {
  protected readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  protected readonly confirmed = signal(false);
  protected readonly error = signal('');

  /** Requires fresh consent if another tab changes the identity affected by Google linking. */
  constructor() {
    effect(() => {
      this.session.user();
      this.confirmed.set(false);
    });
  }

  /** Requires the relevant confirmation and prevents duplicate access actions while Firebase is busy. */
  protected async proceed(): Promise<void> {
    if (this.session.busy() || !this.confirmed()) return;
    this.error.set('');
    try {
      await this.useGoogle();
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }

  /** Routes existing profiles to chat and new or converted identities to avatar setup. */
  private async useGoogle(): Promise<void> {
    const wasGuest = this.session.isGuest();
    await this.session.google();
    if (this.destroy.destroyed) return;
    await this.router.navigateByUrl(
      !wasGuest && (this.session.profile() || this.session.profileError())
        ? '/chat'
        : '/avatar-auswahl',
    );
  }
}
