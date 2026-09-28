import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  effect,
  inject,
  model,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { authIssue } from '../../core/auth/auth-errors';

/** Presents account-switch controls without treating the displayed identity as proof of guest status. */
@Component({
  selector: 'app-session-notice',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-notice.html',
  styleUrl: './session-notice.scss',
})
export class SessionNotice {
  private readonly injector = inject(Injector);
  protected readonly session = inject(AuthSession);
  protected readonly error = signal('');
  readonly confirmedGuestUid = model('');

  /** Invalidates an earlier guest-switch confirmation whenever the observed account changes. */
  constructor() {
    effect(() => {
      this.session.user();
      this.confirmedGuestUid.set('');
      this.error.set('');
    });
  }

  /** Binds acknowledgement to the current UID so it cannot authorize replacing a different guest. */
  protected confirmGuest(checked: boolean): void {
    this.confirmedGuestUid.set(checked ? (this.session.user()?.uid ?? '') : '');
  }

  /** Signs out a regular session and focuses email entry; guest access needs its separate confirmation. */
  protected async switchAccount(): Promise<void> {
    if (this.session.busy() || this.session.isGuest()) return;
    this.error.set('');
    try {
      await this.session.logout();
      afterNextRender(() => document.getElementById('auth-email')?.focus(), {
        injector: this.injector,
      });
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }
}
