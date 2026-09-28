import { initializeApp } from 'firebase/app';
import {
  Auth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onIdTokenChanged,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  Firestore,
  Transaction,
  initializeFirestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { FirebaseSettings } from './firebase-settings';
import { loadGuestProfile } from './guest-profile';
import { LogoutFence } from './logout-fence';
import { PresenceClient } from '../presence/presence-client';
import { PresenceState } from '../presence/presence-state';
import {
  AccountIdentity,
  ProfileDraft,
  UserProfile,
  readUserProfile,
  validProfileDraft,
} from '../auth/user-profile';

/** Loaded only after an explicitly supplied configuration has been validated. */
export class FirebaseRuntime {
  private readonly auth: Auth;
  private readonly database: Firestore;
  private readonly logoutFence: LogoutFence;
  readonly presence: PresenceClient;

  /** Creates isolated SDK clients with explicit persistence and connects local emulators only when configured. */
  constructor(settings: FirebaseSettings, presence: PresenceState) {
    const app = initializeApp(settings.firebase, 'dabubble');
    this.logoutFence = new LogoutFence(settings.firebase.projectId!);
    this.auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
    this.database = initializeFirestore(app, {});
    this.auth.languageCode = 'de';
    if (settings.emulators) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.database, '127.0.0.1', 8080);
    }
    this.presence = new PresenceClient(app, settings, presence, this.auth);
  }

  /** Projects the current SDK user into non-secret identity fields for application state. */
  identity(): AccountIdentity | null {
    const user = this.auth.currentUser;
    return user
      ? {
          uid: user.uid,
          email: user.email,
          isAnonymous: user.isAnonymous,
          displayName: user.displayName,
          providerIds: user.providerData.map((entry) => entry.providerId),
        }
      : null;
  }

  /** Exposes this runtime's Firestore client so chat uses the same project and authentication context. */
  chatDatabase(): Firestore {
    return this.database;
  }

  /** Notifies callers of token-driven identity changes and returns the SDK unsubscribe function. */
  observeUser(next: (user: AccountIdentity | null) => void): () => void {
    return onIdTokenChanged(this.auth, () => {
      next(this.identity());
    });
  }

  /** Wraps email sign-in in the cross-tab logout fence to reject stale successful attempts. */
  login(email: string, password: string, confirmedGuestUid?: string): Promise<void> {
    return this.authenticate(() => this.signInEmail(email, password, confirmedGuestUid));
  }

  /** Requires explicit guest-switch confirmation and retains the current session if new credentials fail. */
  private async signInEmail(
    email: string,
    password: string,
    confirmedGuestUid?: string,
  ): Promise<void> {
    await this.auth.authStateReady();
    const current = this.auth.currentUser;
    if (current?.isAnonymous && current.uid !== confirmedGuestUid)
      throw new Error('auth/guest-switch-confirmation-required');
    // Firebase replaces the current session only after the new credentials succeed.
    // Do not sign out first: a failed login must retain the original account's access.
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  /** Creates or links email credentials without allowing a concurrent logout to be undone. */
  register(email: string, password: string): Promise<void> {
    return this.authenticate(() => this.createOrLink(email, password));
  }

  /** Upgrades anonymous users in place; otherwise creates a new account only from a signed-out session. */
  private async createOrLink(email: string, password: string): Promise<void> {
    const user = this.auth.currentUser;
    if (user?.isAnonymous) {
      await linkWithCredential(user, EmailAuthProvider.credential(email.trim(), password));
      await user.getIdToken(true);
    } else {
      if (user) throw new Error('auth/session-active');
      await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    }
  }

  /** Runs Google authentication under the logout fence, with linking controlled by the caller. */
  google(linkExisting: boolean): Promise<void> {
    return this.authenticate(() => this.signInGoogle(linkExisting));
  }

  /** Links guests or explicitly confirmed users; otherwise opens account selection for a signed-out login. */
  private async signInGoogle(linkExisting: boolean): Promise<void> {
    const user = this.auth.currentUser;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (user?.isAnonymous || (user && linkExisting)) {
      await linkWithPopup(user, provider, browserPopupRedirectResolver);
      await user.getIdToken(true);
    } else {
      if (user || linkExisting) throw new Error('auth/session-active');
      await signInWithPopup(this.auth, provider, browserPopupRedirectResolver);
    }
  }

  /** Runs anonymous sign-in under the same cross-tab logout protection as regular sign-in. */
  guest(): Promise<void> {
    return this.authenticate(() => this.signInGuest());
  }

  /** Reuses a restored anonymous session and refuses to replace a regular account silently. */
  private async signInGuest(): Promise<void> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser;
    if (user?.isAnonymous) return;
    if (user) throw new Error('auth/guest-account-active');
    await signInAnonymously(this.auth);
  }

  /** Disconnects presence and signs out without deleting data; restores presence if sign-out fails. */
  async logout(): Promise<void> {
    await this.auth.authStateReady();
    this.presence.identify('');
    try {
      await signOut(this.auth);
      if (this.auth.currentUser) throw new Error('auth/sign-out-incomplete');
      this.logoutFence.publish();
    } catch (error) {
      this.presence.identify(this.auth.currentUser?.uid ?? '');
      throw error;
    }
  }

  /** A late Firebase response must not undo a completed logout in another tab. */
  private async authenticate(operation: () => Promise<unknown>): Promise<void> {
    const version = this.logoutFence.version();
    await operation();
    if (version === this.logoutFence.version()) return;
    await this.logout();
    throw new Error('auth/session-ended');
  }

  /** Disposes presence listeners and cross-tab logout notifications without deleting persisted account data. */
  destroy(): void {
    this.presence.destroy();
    this.logoutFence.destroy();
  }

  /** Requests a German reset email with the current origin's hash-based login as the return address. */
  sendReset(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email.trim(), {
      url: new URL('/#/anmeldung', location.origin).href,
    });
  }

  /** Checks an action code with Firebase without applying a password change. */
  verifyReset(code: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, code);
  }

  /** Consumes a reset action code to set the supplied password through Firebase Authentication. */
  confirmReset(code: string, password: string): Promise<void> {
    return confirmPasswordReset(this.auth, code, password);
  }

  /** Reads a regular profile from the server or transactionally initializes a missing guest profile. */
  async loadProfile(uid: string, guest = false): Promise<UserProfile | null> {
    if (guest) return loadGuestProfile(this.database, uid);
    const snapshot = await getDocFromServer(doc(this.database, 'users', uid));
    return snapshot.exists() ? readUserProfile(snapshot.data(), uid) : null;
  }

  /** Validates editable fields and atomically writes the current account's profile before returning it. */
  async saveProfile(draft: ProfileDraft): Promise<UserProfile> {
    const uid = this.auth.currentUser?.uid;
    if (!uid || !validProfileDraft(draft)) throw new Error('invalid-profile');
    const profile = { uid, name: draft.name.trim(), avatarId: draft.avatarId };
    await runTransaction(this.database, (transaction) => this.writeProfile(transaction, profile), {
      maxAttempts: 2,
    });
    return profile;
  }

  /** Preserves creation time on updates and assigns server timestamps when creating a profile. */
  private async writeProfile(transaction: Transaction, profile: UserProfile): Promise<void> {
    const reference = doc(this.database, 'users', profile.uid);
    const snapshot = await transaction.get(reference);
    if (snapshot.exists())
      transaction.update(reference, { ...profile, updatedAt: serverTimestamp() });
    else
      transaction.set(reference, {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  }
}
