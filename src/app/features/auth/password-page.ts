import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  computed,
  inject,
  signal,
  untracked,
  viewChildren,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';
import { Icon } from '../../shared/ui/icon';
import { FormField, fieldError } from '../../shared/ui/form-field';
import { AuthSession } from '../../core/auth/auth-session';
import { AuthIssue, authIssue, errorCode } from '../../core/auth/auth-errors';
import { ConfirmationKind } from '../../shared/ui/confirmation-message';
import { SuccessOverlay } from '../../shared/ui/success-overlay';

/** Handles real reset requests and email action codes with validation and persistence-backed success feedback. */
@Component({
  selector: 'app-password-page',
  imports: [PublicLayout, RouterLink, Icon, FormField, SuccessOverlay],
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
  protected readonly completion = signal<ConfirmationKind | null>(null);
  protected readonly verified = signal(false);
  protected readonly submitted = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  protected readonly isReset = computed(() => this.data()['mode'] === 'reset');
  private readonly parameters = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly code = computed(() => this.parameters().get('oobCode') ?? '');
  private verification = 0;
  private verificationQueue = Promise.resolve();
  private readonly fields = viewChildren(FormField);
  private readonly injector = inject(Injector);
  private readonly continueLink = viewChild<ElementRef<HTMLAnchorElement>>('continueLink');
  protected readonly valid = computed(() =>
    this.isReset()
      ? !fieldError('password', this.password()) &&
        !fieldError('confirmation', this.confirmation(), this.password())
      : !fieldError('email', this.email()),
  );

  /** Rechecks changed action parameters and invalidates pending verification results when the page is destroyed. */
  constructor() {
    inject(DestroyRef).onDestroy(() => this.verification++);
    effect(() => {
      const parameters = this.parameters(),
        reset = this.isReset();
      const revision = ++this.verification;
      untracked(() => this.prepareVerification(parameters, reset, revision));
    });
  }

  /** Clears previous reset state and queues verification so obsolete links cannot enable the current form. */
  private prepareVerification(parameters: ParamMap, reset: boolean, revision: number): void {
    this.verified.set(false);
    this.issue.set(null);
    this.success.set('');
    this.completion.set(null);
    this.clearResetFields();
    if (reset)
      this.verificationQueue = this.verificationQueue.then(() =>
        this.verifyLink(parameters, revision),
      );
  }

  /** Removes password values and validation-touch state after link changes or a completed password update. */
  private clearResetFields(): void {
    this.password.set('');
    this.confirmation.set('');
    this.submitted.set(false);
    for (const field of this.fields()) field.reset();
  }

  /** Enables reset submission only after Firebase validates the current, still-active action code. */
  private async verifyLink(parameters: ParamMap, revision: number): Promise<void> {
    await this.session.ready;
    if (revision !== this.verification || !this.session.configured()) return;
    try {
      const code = this.validateResetLink(parameters);
      await this.session.verifyReset(code);
      if (revision === this.verification) this.verified.set(true);
    } catch (error) {
      if (revision === this.verification) this.issue.set(authIssue(error));
    }
  }

  /** Rejects unsupported email actions and missing reset codes before contacting Firebase. */
  private validateResetLink(parameters: ParamMap): string {
    const mode = parameters.get('mode') ?? 'resetPassword';
    const code = parameters.get('oobCode') ?? '';
    if (mode !== 'resetPassword') throw new Error('auth/unsupported-email-action');
    if (!code) throw new Error('auth/invalid-action-code');
    return code;
  }

  /** Prevents duplicate or invalid reset actions and maps failures to the corresponding form feedback. */
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

  /** Uses the same neutral confirmation for existing and unknown addresses to avoid disclosing account existence. */
  private async requestReset(): Promise<void> {
    try {
      await this.session.sendReset(this.email());
    } catch (error) {
      if (errorCode(error) !== 'auth/user-not-found') throw error;
    }
    this.success.set(
      'Wenn ein Konto mit dieser E-Mail-Adresse existiert, erhältst du eine E-Mail zum Zurücksetzen. Bitte prüfe auch deinen Spam-Ordner.',
    );
    this.completion.set('email');
  }

  /** Shows the sign-in confirmation only after Firebase accepts the verified password change. */
  private async changePassword(): Promise<void> {
    if (!this.verified()) return;
    await this.session.confirmReset(this.code(), this.password());
    this.clearResetFields();
    this.verified.set(false);
    this.success.set(
      'Dein Passwort wurde geändert. Du kannst dich jetzt mit dem neuen Passwort anmelden.',
    );
    this.completion.set('signin');
  }

  /** Restores focus to the rendered login link after the success overlay is dismissed. */
  protected finishConfirmation(): void {
    this.completion.set(null);
    afterNextRender(() => this.continueLink()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Selects backend validation feedback for the requested password or identity field. */
  protected fieldIssue(field: AuthIssue['field']): string {
    return this.issue()?.field === field ? this.issue()!.message : '';
  }
}
