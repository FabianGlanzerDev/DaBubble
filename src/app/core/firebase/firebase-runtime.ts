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
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
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

  constructor(settings: FirebaseSettings) {
    const app = initializeApp(settings.firebase, 'dabubble');
    this.auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
    this.database = initializeFirestore(app, {});
    this.auth.languageCode = 'de';
    if (settings.emulators) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.database, '127.0.0.1', 8080);
    }
  }

  identity(): AccountIdentity | null {
    const user = this.auth.currentUser;
    return user ? { uid: user.uid, email: user.email } : null;
  }

  chatDatabase(): Firestore {
    return this.database;
  }

  observeUser(next: (user: AccountIdentity | null) => void): () => void {
    return onAuthStateChanged(this.auth, () => next(this.identity()));
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async register(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email.trim(), password);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  sendReset(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email.trim(), {
      url: new URL('/anmeldung', location.origin).href,
    });
  }

  verifyReset(code: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, code);
  }

  confirmReset(code: string, password: string): Promise<void> {
    return confirmPasswordReset(this.auth, code, password);
  }

  async loadProfile(uid: string): Promise<UserProfile | null> {
    const snapshot = await getDocFromServer(doc(this.database, 'users', uid));
    return snapshot.exists() ? readUserProfile(snapshot.data(), uid) : null;
  }

  async saveProfile(draft: ProfileDraft): Promise<UserProfile> {
    const uid = this.auth.currentUser?.uid;
    if (!uid || !validProfileDraft(draft)) throw new Error('invalid-profile');
    const profile = { uid, name: draft.name.trim(), avatarId: draft.avatarId };
    await runTransaction(this.database, (transaction) => this.writeProfile(transaction, profile), {
      maxAttempts: 2,
    });
    return profile;
  }

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
