import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';
import { Icon } from '../../shared/ui/icon';
import { FormField, fieldError } from '../../shared/ui/form-field';
import { RegistrationPreview } from './registration-preview';
import { AuthSession } from '../../core/auth/auth-session';
import { AuthIssue, authIssue } from '../../core/auth/auth-errors';

const pages = {
  login: {
    title: 'Anmeldung',
    description:
      'Wir empfehlen dir, die E-Mail-Adresse zu nutzen, die du bei der Arbeit verwendest.',
    notice: 'Layout-Vorschau · Anmeldung, Google- und Gäste-Login sind noch nicht verfügbar.',
  },
  register: {
    title: 'Konto erstellen',
    description: 'Mit deinem Namen und deiner E-Mail-Adresse hast du dein neues DABubble-Konto.',
    notice: 'Layout-Vorschau · Keine Registrierung. „Weiter“ öffnet nur die Avatar-Vorschau.',
  },
} as const;
type Mode = keyof typeof pages;

@Component({
  selector: 'app-auth-page',
  imports: [PublicLayout, Icon, RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  protected readonly session = inject(AuthSession);
  protected readonly issue = signal<AuthIssue | null>(null);
  protected readonly submitted = signal(false);
  private readonly router = inject(Router);
  private readonly registration = inject(RegistrationPreview);
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly consent = signal(false);
  protected readonly valid = computed(
    () =>
      !fieldError('name', this.name()) &&
      !fieldError('email', this.email()) &&
      !fieldError('password', this.password()) &&
      this.consent(),
  );
  protected readonly loginValid = computed(
    () => !fieldError('email', this.email()) && !!this.password(),
  );
  protected readonly notice = computed(
    () =>
      this.session.setupError() ||
      (this.session.configured()
        ? (this.session.emulated() ? 'Lokaler Firebase-Emulator. ' : '') +
          'E-Mail-Anmeldung verfügbar. Google- und Gäste-Login sind nicht eingerichtet.'
        : this.page().notice),
  );
  readonly embedded = input(false);
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly mode = computed(() => (this.data()['mode'] as Mode | undefined) ?? 'login');
  protected readonly page = computed(() => pages[this.mode()]);
  protected readonly accessBlocked = computed(
    () => this.query().get('hinweis') === 'anmeldung-ausstehend',
  );

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.session.busy()) return;
    this.submitted.set(true);
    this.issue.set(null);
    if (this.mode() === 'register') await this.register();
    else if (this.loginValid() && this.session.configured()) await this.login();
  }

  private async register(): Promise<void> {
    if (!this.valid()) return;
    this.registration.name.set(this.name().trim());
    if (!this.session.configured()) return this.openPreview();
    try {
      await this.session.register(this.email(), this.password(), this.name());
      this.password.set('');
      await this.router.navigateByUrl('/avatar-auswahl');
    } catch (error) {
      this.issue.set(authIssue(error));
    }
  }

  private openPreview(): void {
    void this.router.navigateByUrl('/avatar-vorschau');
  }

  private async login(): Promise<void> {
    try {
      await this.session.login(this.email(), this.password());
      this.password.set('');
      const destination = this.query().get('returnUrl') ?? '/chat';
      await this.router.navigateByUrl(
        /^\/chat(?:[/?#]|$)/.test(destination) ? destination : '/chat',
      );
    } catch (error) {
      this.issue.set(authIssue(error));
    }
  }

  protected fieldIssue(field: AuthIssue['field']): string {
    return this.issue()?.field === field ? this.issue()!.message : '';
  }
}
