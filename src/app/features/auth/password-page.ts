import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';
import { Icon } from '../../shared/ui/icon';
import { FormField, fieldError } from '../../shared/ui/form-field';
import { AuthSession } from '../../core/auth/auth-session';
import { AuthIssue, authIssue, errorCode } from '../../core/auth/auth-errors';

@Component({
  selector: 'app-password-page',
  imports: [PublicLayout, RouterLink, Icon, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './password-page.html',
  styleUrl: './password-page.scss',
})
export class PasswordPage {
  protected readonly session = inject(AuthSession);
  protected readonly email = signal('');
  protected readonly confirmation = signal('');
  protected readonly password = signal('');
  protected readonly issue = signal<AuthIssue | null>(null);
  protected readonly success = signal('');
  protected readonly verified = signal(false);
  protected readonly submitted = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  protected readonly isReset = computed(() => this.data()['mode'] === 'reset');
  private readonly code = this.route.snapshot.queryParamMap.get('oobCode') ?? '';
  protected readonly valid = computed(() =>
    this.isReset()
      ? !fieldError('password', this.password()) &&
        !fieldError('confirmation', this.confirmation(), this.password())
      : !fieldError('email', this.email()),
  );

  constructor() {
    afterNextRender(() => void this.verifyLink());
  }

  private async verifyLink(): Promise<void> {
    await this.session.ready;
    if (!this.isReset() || !this.session.configured()) return;
    try {
      this.validateResetLink();
      await this.session.verifyReset(this.code);
      this.verified.set(true);
    } catch (error) {
      this.issue.set(authIssue(error));
    }
  }

  private validateResetLink(): void {
    const mode = this.route.snapshot.queryParamMap.get('mode') ?? 'resetPassword';
    if (!this.code || mode !== 'resetPassword') throw new Error('auth/invalid-action-code');
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.valid() || !this.session.configured() || this.session.busy() || this.success())
      return;
    this.issue.set(null);
    try {
      if (this.isReset()) await this.changePassword();
      else await this.requestReset();
    } catch (error) {
      this.issue.set(authIssue(error));
    }
  }

  private async requestReset(): Promise<void> {
    try {
      await this.session.sendReset(this.email());
    } catch (error) {
      if (errorCode(error) !== 'auth/user-not-found') throw error;
    }
    this.success.set(
      'Wenn ein Konto mit dieser E-Mail-Adresse existiert, erhältst du eine E-Mail zum Zurücksetzen. Bitte prüfe auch deinen Spam-Ordner.',
    );
  }

  private async changePassword(): Promise<void> {
    if (!this.verified()) return;
    await this.session.confirmReset(this.code, this.password());
    this.password.set('');
    this.confirmation.set('');
    this.verified.set(false);
    this.success.set(
      'Dein Passwort wurde geändert. Du kannst dich jetzt mit dem neuen Passwort anmelden.',
    );
  }

  protected fieldIssue(field: AuthIssue['field']): string {
    return this.issue()?.field === field ? this.issue()!.message : '';
  }
}
