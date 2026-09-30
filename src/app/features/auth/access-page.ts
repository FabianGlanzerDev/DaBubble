import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthSession } from '../../core/auth/auth-session';
import { authIssue } from '../../core/auth/auth-errors';
import { PublicLayout } from '../../shared/layout/public-layout';
import { Icon } from '../../shared/ui/icon';

/** Explains Google sign-in and protects anonymous access before an explicit guest logout. */
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
  private readonly route = inject(ActivatedRoute);
  private readonly parameters = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly kind = computed(() => this.parameters().get('art'));
  protected readonly guest = computed(() => this.kind() === 'gast');
  protected readonly confirmed = signal(false);
  protected readonly logoutConfirmed = signal(false);
  protected readonly error = signal('');

  /** Rejects stale guest-management routes and resets confirmations when access parameters change. */
  constructor() {
    effect(() => {
      if (this.guest() && !this.session.initializing() && !this.session.isGuest())
        void this.router.navigateByUrl('/anmeldung', { replaceUrl: true });
    });
    effect(() => {
      this.parameters();
      this.error.set('');
    });
    effect(() => this.resetConfirmations());
  }

  /** Requires fresh consent when navigation or a second tab changes the account affected by this page. */
  private resetConfirmations(): void {
    this.parameters();
    this.session.user();
    this.confirmed.set(false);
    this.logoutConfirmed.set(false);
  }

  /** Requires the relevant confirmation and prevents duplicate access actions while Firebase is busy. */
  protected async proceed(): Promise<void> {
    if (this.session.busy() || (!this.guest() && !this.confirmed())) return;
    this.error.set('');
    try {
      if (this.guest()) {
        await this.session.guest();
        await this.router.navigateByUrl('/chat');
      } else await this.useGoogle();
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

  /** Signs out only after explicit acknowledgement, preserving the guest account and its chat data. */
  protected async endGuest(): Promise<void> {
    if (!this.session.isGuest() || !this.logoutConfirmed() || this.session.busy()) return;
    this.error.set('');
    try {
      await this.session.logout();
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }
}
