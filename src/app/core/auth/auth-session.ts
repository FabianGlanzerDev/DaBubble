import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseSettings, loadFirebaseSettings } from '../firebase/firebase-settings';
import type { FirebaseRuntime } from '../firebase/firebase-runtime';
import { AccountIdentity, ProfileDraft, UserProfile } from './user-profile';
import { authIssue } from './auth-errors';

type Action = 'login' | 'register' | 'logout' | 'profile' | 'reset' | 'verify-reset';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  private client: FirebaseRuntime | null = null;
  private revision = 0;
  private profileLoad: Promise<void> = Promise.resolve();
  readonly user = signal<AccountIdentity | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly profileLoading = signal(false);
  readonly profileError = signal('');
  readonly initializing = signal(true);
  readonly configured = signal(false);
  readonly emulated = signal(false);
  readonly setupError = signal('');
  readonly pending = signal<Action | null>(null);
  readonly busy = computed(() => this.initializing() || this.pending() !== null);
  readonly pendingName = signal('');
  readonly ready = this.initialize();

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

  private async connect(settings: FirebaseSettings): Promise<void> {
    const { FirebaseRuntime } = await import('../firebase/firebase-runtime');
    this.client = new FirebaseRuntime(settings);
    this.emulated.set(settings.emulators);
  }

  private restoreSession(): Promise<void> {
    return new Promise((resolve) => {
      const unsubscribe = this.requireClient().observeUser((user) => {
        void this.changeUser(user).then(resolve);
      });
      this.destroy.onDestroy(unsubscribe);
    });
  }

  private changeUser(user: AccountIdentity | null): Promise<void> {
    if (this.user()?.uid === user?.uid) return this.profileLoad;
    const wasSignedIn = !!this.user();
    this.user.set(user);
    this.profile.set(null);
    this.profileError.set('');
    this.profileLoading.set(!!user);
    const revision = ++this.revision;
    this.profileLoad = user ? this.fetchProfile(user.uid, revision) : Promise.resolve();
    if (!user && wasSignedIn) this.returnToLogin();
    return this.profileLoad;
  }

  private async fetchProfile(uid: string, revision: number): Promise<void> {
    try {
      const profile = await this.limitProfileRead(this.requireClient().loadProfile(uid));
      if (revision === this.revision) this.profile.set(profile);
    } catch (error) {
      if (revision === this.revision) this.profileError.set(authIssue(error).message);
    } finally {
      if (revision === this.revision) this.profileLoading.set(false);
    }
  }

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

  async reloadProfile(): Promise<void> {
    const user = this.user();
    if (!user || this.profileLoading()) return;
    this.profileLoading.set(true);
    this.profileError.set('');
    this.profileLoad = this.fetchProfile(user.uid, ++this.revision);
    await this.profileLoad;
  }

  async login(email: string, password: string): Promise<void> {
    await this.perform('login', async (client) => {
      await client.login(email, password);
      await this.changeUser(client.identity());
    });
  }

  async register(email: string, password: string, name: string): Promise<void> {
    await this.perform('register', async (client) => {
      await client.register(email, password);
      this.pendingName.set(name.trim());
      await this.changeUser(client.identity());
    });
  }

  async logout(): Promise<void> {
    await this.perform('logout', async (client) => {
      await client.logout();
      this.pendingName.set('');
      await this.changeUser(null);
    });
  }

  async saveProfile(draft: ProfileDraft): Promise<void> {
    await this.perform('profile', async (client) => {
      const uid = this.user()?.uid;
      const profile = await client.saveProfile(draft);
      if (uid === this.user()?.uid) this.profile.set(profile);
      this.profileError.set('');
      this.pendingName.set('');
    });
  }

  sendReset(email: string): Promise<void> {
    return this.perform('reset', (client) => client.sendReset(email));
  }

  verifyReset(code: string): Promise<string> {
    return this.perform('verify-reset', (client) => client.verifyReset(code));
  }

  confirmReset(code: string, password: string): Promise<void> {
    return this.perform('reset', (client) => client.confirmReset(code, password));
  }

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

  private requireClient(): FirebaseRuntime {
    if (!this.client) throw new Error('firebase/configuration');
    return this.client;
  }

  private returnToLogin(): void {
    if (/^\/(?:chat|avatar-auswahl)(?:[/?#]|$)/.test(this.router.url))
      void this.router.navigateByUrl('/anmeldung', { replaceUrl: true });
  }
}
