import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';
import { Icon } from '../../shared/ui/icon';
import { FormField, fieldError } from '../../shared/ui/form-field';
import { AuthSession } from '../../core/auth/auth-session';
import { AuthIssue, authIssue, guestIssue } from '../../core/auth/auth-errors';
import { SessionNotice } from './session-notice';

const pages = {
  login: {
    title: 'Anmeldung',
    description:
      'Wir empfehlen dir, die E-Mail-Adresse zu nutzen, die du bei der Arbeit verwendest.',
  },
  register: {
    title: 'Konto erstellen',
    description: 'Mit deinem Namen und deiner E-Mail-Adresse hast du dein neues DABubble-Konto.',
  },
} as const;
/** Selects the existing login or registration presentation and its corresponding submission behavior. */
type Mode = keyof typeof pages;

/** Validates login and signup forms while preserving persisted sessions and recoverable avatar setup. */
@Component({
  selector: 'app-auth-page',
  imports: [PublicLayout, Icon, RouterLink, FormField, SessionNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  protected readonly session = inject(AuthSession);
  protected readonly issue = signal<AuthIssue | null>(null);
  protected readonly submitted = signal(false);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly fields = viewChildren(FormField);
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly consent = signal(false);
  protected readonly confirmedGuestUid = signal('');
  protected readonly progress = computed(() =>
    this.session.registration.forUser(this.session.user()),
  );
  protected readonly resuming = computed(() => this.mode() === 'register' && !!this.progress());
  protected readonly valid = computed(
    () =>
      !fieldError('name', this.name()) &&
      !fieldError('email', this.email()) &&
      (this.resuming() || !fieldError('password', this.password())) &&
      this.consent(),
  );
  protected readonly loginValid = computed(
    () => !fieldError('email', this.email()) && !!this.password(),
  );
  protected readonly notice = computed(
    () =>
      this.session.setupError() ||
      (this.session.initializing()
        ? 'Anmeldung wird vorbereitet…'
        : this.session.configured()
          ? ''
          : 'Die Anmeldung ist derzeit nicht verfügbar. Bitte versuche es später erneut.'),
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

  /** Restores unfinished signup details and clears login fields when authentication becomes signed out. */
  constructor() {
    effect(() => this.restoreRegistration());
    effect(() => {
      if (this.mode() === 'login' && !this.session.initializing() && !this.session.user())
        untracked(() => this.clearLogin());
    });
  }

  /** Restores name, email and prior consent for an account whose avatar setup is still incomplete. */
  private restoreRegistration(): void {
    const draft = this.progress();
    if (!this.resuming() || !draft) return;
    this.name.set(draft.name);
    this.email.set(draft.email);
    this.consent.set(true);
  }

  /** Removes prior form values and guest confirmation after logout while retaining designated sign-out errors. */
  private clearLogin(): void {
    this.email.set('');
    this.password.set('');
    if (!this.issue()?.retainOnSignOut) this.issue.set(null);
    this.submitted.set(false);
    this.confirmedGuestUid.set('');
    for (const field of this.fields()) field.reset();
  }

  /** Dispatches validated form submission to login or registration without overlapping authentication actions. */
  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.session.busy()) return;
    this.submitted.set(true);
    this.issue.set(null);
    if (this.mode() === 'register') await this.register();
    else if (this.loginValid() && this.session.configured()) await this.login();
  }

  /** Starts guest access directly and opens the Google flow only when it is configured as available. */
  protected openAccess(kind: 'google' | 'gast'): void {
    if (this.session.busy()) return;
    if (kind === 'gast') void this.startGuest();
    else if (this.session.googleAvailable()) void this.router.navigateByUrl('/zugang/' + kind);
  }

  /** Opens real chat after anonymous authentication and displays guest-specific errors without stale navigation. */
  private async startGuest(): Promise<void> {
    this.issue.set(null);
    try {
      await this.session.guest();
      if (!this.destroy.destroyed) await this.router.navigateByUrl('/chat');
    } catch (error) {
      this.issue.set(guestIssue(error));
    }
  }

  /** Creates or resumes signup, clears the password and advances to avatar selection only after success. */
  private async register(): Promise<void> {
    if (!this.valid() || !this.session.configured()) return;
    try {
      if (this.resuming())
        this.session.registration.update(this.session.user(), this.name().trim());
      else await this.session.register(this.email(), this.password(), this.name());
      this.password.set('');
      if (!this.destroy.destroyed) await this.router.navigateByUrl('/avatar-auswahl');
    } catch (error) {
      this.issue.set(authIssue(error));
    }
  }

  /** Signs in with confirmed session-switch intent and restricts the return destination to internal chat routes. */
  private async login(): Promise<void> {
    try {
      await this.session.login(this.email(), this.password(), this.confirmedGuestUid());
      this.password.set('');
      const destination = this.query().get('returnUrl') ?? '/chat';
      await this.router.navigateByUrl(
        /^\/chat(?:[/?#]|$)/.test(destination) ? destination : '/chat',
      );
    } catch (error) {
      this.issue.set(authIssue(error));
    }
  }

  /** Returns server feedback only for the field assigned to that authentication failure. */
  protected fieldIssue(field: AuthIssue['field']): string {
    return this.issue()?.field === field ? this.issue()!.message : '';
  }
}
