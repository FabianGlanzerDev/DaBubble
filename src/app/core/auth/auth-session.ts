import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseSettings, loadFirebaseSettings } from '../firebase/firebase-settings';
import type { FirebaseRuntime } from '../firebase/firebase-runtime';
import { AccountIdentity, ProfileDraft, UserProfile } from './user-profile';
import { authIssue } from './auth-errors';
import { RegistrationProgress } from './registration-progress';
import { PresenceState } from '../presence/presence-state';

/** Operation identifiers used to expose pending authentication state and block duplicate submissions. */
type Action =
  'login' | 'register' | 'logout' | 'profile' | 'reset' | 'verify-reset' | 'google' | 'guest';

/** Coordinates persisted Firebase identity, profile loading and UI state across authentication changes. */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly registration = inject(RegistrationProgress);
  readonly presence = inject(PresenceState);
  private client: FirebaseRuntime | null = null;
  private revision = 0;
  private profileLoad: Promise<void> = Promise.resolve();
  private stopProfileWatch: (() => void) | null = null;
  readonly user = signal<AccountIdentity | null>(null);
  readonly isGuest = computed(() => this.user()?.isAnonymous === true);
  readonly profile = signal<UserProfile | null>(null);
  readonly profileLoading = signal(false);
  readonly profileError = signal('');
  readonly initializing = signal(true);
  readonly configured = signal(false);
  readonly emulated = signal(false);
  readonly googleAvailable = computed(() => this.configured());
  readonly setupError = signal('');
  readonly pending = signal<Action | null>(null);
  readonly busy = computed(() => this.initializing() || this.pending() !== null);
  readonly pendingName = signal('');
  readonly ready = this.initialize();

  /** Releases the private-profile subscription together with the application session. */
  constructor() {
    this.destroy.onDestroy(() => this.stopProfileWatch?.());
  }

  /** Waits for initialization before exposing the configured Firestore client to chat services. */
  async chatDatabase() {
    await this.ready;
    return this.requireClient().chatDatabase();
  }

  /** Delegates the visible UID set to presence tracking when Firebase is available. */
  watchPresence(uids: string[]): void {
    this.client?.presence.watch(uids);
  }

  /** Loads explicit configuration and restores identity before enabling authentication actions. */
  private async initialize(): Promise<void> {
    try {
      const settings = await loadFirebaseSettings();
      if (!settings) return;
      await this.connect(settings);
      await this.restoreSession();
      this.configured.set(true);
    } catch {
      this.setupError.set(authIssue(new Error('firebase/configuration')).message);
    } finally {
      this.initializing.set(false);
    }
  }

  /** Lazily creates the Firebase runtime and registers cleanup for the service lifetime. */
  private async connect(settings: FirebaseSettings): Promise<void> {
    const { FirebaseRuntime } = await import('../firebase/firebase-runtime');
    this.client = new FirebaseRuntime(settings, this.presence);
    this.destroy.onDestroy(() => this.client?.destroy());
    this.emulated.set(settings.emulators);
  }

  /** Resolves after the first identity and profile update while retaining the ongoing token listener. */
  private restoreSession(): Promise<void> {
    return new Promise((resolve) => {
      const unsubscribe = this.requireClient().observeUser((user) => {
        void this.changeUser(user).then(resolve);
      });
      this.destroy.onDestroy(unsubscribe);
    });
  }

  /** Resets account-specific UI state and ignores stale profile results after an identity change. */
  private changeUser(user: AccountIdentity | null): Promise<void> {
    this.syncRegistration(user);
    if (this.refreshIdentity(user)) return this.profileLoad;
    const wasSignedIn = !!this.user();
    this.user.set(user);
    this.resetProfile();
    this.profileLoading.set(!!user);
    const revision = ++this.revision;
    this.profileLoad = user ? this.fetchProfile(user.uid, revision) : Promise.resolve();
    if (!user && wasSignedIn) this.returnToLogin();
    return this.profileLoad;
  }

  /** Detaches the previous account's listener before clearing its displayed profile. */
  private resetProfile(): void {
    this.stopProfileWatch?.();
    this.stopProfileWatch = null;
    this.profile.set(null);
    this.profileError.set('');
  }

  /** Refreshes provider details without refetching the profile when UID and guest state match. */
  private refreshIdentity(user: AccountIdentity | null): boolean {
    const same = this.user()?.uid === user?.uid && this.user()?.isAnonymous === user?.isAnonymous;
    if (same) this.user.set(user);
    return same;
  }

  /** Attaches matching signup progress and clears account-specific drafts on logout. */
  private syncRegistration(user: AccountIdentity | null): void {
    this.registration.attach(user);
    if (user?.uid !== this.user()?.uid) this.pendingName.set('');
    if (!user && this.user()) this.registration.clear();
  }

  /** Publishes profile data or errors only if this request still belongs to the active identity. */
  private async fetchProfile(uid: string, revision: number): Promise<void> {
    try {
      const profile = await this.limitProfileRead(
        this.requireClient().loadProfile(uid, this.isGuest()),
      );
      if (revision === this.revision) this.observeProfile(uid, revision, profile);
    } catch (error) {
      if (revision === this.revision) this.profileError.set(authIssue(error).message);
    } finally {
      if (revision === this.revision) this.profileLoading.set(false);
    }
  }

  /** Replaces one-shot profile state with live updates after the initial authenticated read succeeds. */
  private observeProfile(uid: string, revision: number, profile: UserProfile | null): void {
    this.profile.set(profile);
    this.stopProfileWatch?.();
    this.stopProfileWatch = this.requireClient().watchProfile(
      uid,
      (updated) => this.updateProfile(updated, revision),
      (error) => {
        if (revision === this.revision) this.profileError.set(authIssue(error).message);
      },
    );
  }

  /** Ignores queued changes from a previous account and clears recovered listener errors. */
  private updateProfile(profile: UserProfile | null, revision: number): void {
    if (revision !== this.revision) return;
    this.profile.set(profile);
    this.profileError.set('');
  }

  /** Bounds UI waiting to ten seconds without claiming to cancel the underlying Firestore request. */
  private async limitProfileRead<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('unavailable')), 10000);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Retries the current account's profile read while preventing overlapping retries. */
  async reloadProfile(): Promise<void> {
    const user = this.user();
    if (!user || this.profileLoading()) return;
    this.profileLoading.set(true);
    this.profileError.set('');
    this.profileLoad = this.fetchProfile(user.uid, ++this.revision);
    await this.profileLoad;
  }

  /** Completes email sign-in and refreshes UI identity; guest switching requires its confirmed UID. */
  async login(email: string, password: string, confirmedGuestUid?: string): Promise<void> {
    await this.perform('login', async (client) => {
      await client.login(email, password, confirmedGuestUid);
      await this.changeUser(client.identity());
    });
  }

  /** Saves recoverable setup progress before creating or upgrading an email/password account. */
  async register(email: string, password: string, name: string): Promise<void> {
    await this.perform('register', async (client) => {
      this.registration.prepare(email, name);
      await this.createRegistration(client, email, password);
      this.pendingName.set(name.trim());
      await this.changeUser(client.identity());
    });
  }

  /** Removes only an unbound setup draft when account creation or linking fails. */
  private async createRegistration(
    client: FirebaseRuntime,
    email: string,
    password: string,
  ): Promise<void> {
    try {
      await client.register(email, password);
    } catch (error) {
      this.registration.cancelPreparation();
      throw error;
    }
  }

  /** Ends authentication, clears local signup state and replaces the route without deleting account data. */
  async logout(): Promise<void> {
    await this.perform('logout', async (client) => {
      await client.logout();
      this.registration.clear();
      this.pendingName.set('');
      await this.changeUser(null);
    });
    await this.router.navigateByUrl('/anmeldung', { replaceUrl: true });
  }

  /** Runs Google sign-in or explicit linking and carries the provider name into profile setup. */
  async google(linkExisting = false): Promise<void> {
    await this.perform('google', async (client) => {
      await client.google(linkExisting);
      this.pendingName.set(client.identity()?.displayName?.trim().slice(0, 80) ?? '');
      await this.changeUser(client.identity());
    });
  }

  /** Restores or creates anonymous access and synchronizes its real profile with the UI. */
  async guest(): Promise<void> {
    await this.perform('guest', async (client) => {
      await client.guest();
      await this.changeUser(client.identity());
    });
  }

  /** Publishes a saved profile only while the submitting account is still active. */
  async saveProfile(draft: ProfileDraft): Promise<void> {
    await this.perform('profile', async (client) => {
      const uid = this.user()?.uid;
      const profile = await client.saveProfile(draft);
      if (uid === this.user()?.uid) this.profile.set(profile);
      this.profileError.set('');
      this.pendingName.set('');
    });
  }

  /** Requests a reset email through the configured runtime with duplicate submission protection. */
  sendReset(email: string): Promise<void> {
    return this.perform('reset', (client) => client.sendReset(email));
  }

  /** Validates an email action code and returns the associated email without changing its password. */
  verifyReset(code: string): Promise<string> {
    return this.perform('verify-reset', (client) => client.verifyReset(code));
  }

  /** Submits a replacement password for a verified reset action through the shared busy state. */
  confirmReset(code: string, password: string): Promise<void> {
    return this.perform('reset', (client) => client.confirmReset(code, password));
  }

  /** Serializes authentication actions and releases the pending indicator even when an operation fails. */
  private async perform<T>(
    action: Action,
    operation: (client: FirebaseRuntime) => Promise<T>,
  ): Promise<T> {
    if (this.pending()) throw new Error('auth/busy');
    this.pending.set(action);
    try {
      await this.ready;
      return await operation(this.requireClient());
    } finally {
      this.pending.set(null);
    }
  }

  /** Rejects authentication operations when no validated Firebase runtime has been created. */
  private requireClient(): FirebaseRuntime {
    if (!this.client) throw new Error('firebase/configuration');
    return this.client;
  }

  /** Replaces protected chat or setup routes after logout while leaving public routes unchanged. */
  private returnToLogin(): void {
    if (/^\/(?:chat|avatar-auswahl)(?:[/?#]|$)/.test(this.router.url))
      void this.router.navigateByUrl('/anmeldung', { replaceUrl: true });
  }
}
