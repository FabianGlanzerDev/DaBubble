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

  constructor() {
    effect(() => {
      this.session.user();
      this.confirmedGuestUid.set('');
      this.error.set('');
    });
  }

  protected confirmGuest(checked: boolean): void {
    this.confirmedGuestUid.set(checked ? (this.session.user()?.uid ?? '') : '');
  }

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
