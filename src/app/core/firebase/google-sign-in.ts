import { FirebaseError, deleteApp, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  OAuthCredential,
  User,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  deleteUser,
  inMemoryPersistence,
  initializeAuth,
  linkWithPopup,
  reload,
  signInAnonymously,
  signInWithCredential,
} from 'firebase/auth';

/** Uses linking because direct Google sign-in can replace an unverified password provider without a collision error. */
export async function signInGoogleSafely(auth: Auth, provider: GoogleAuthProvider): Promise<void> {
  const isolated = isolatedAuth(auth);
  const initialUid = auth.currentUser?.uid;
  let createdUid = '';
  try {
    const temporary = await signInAnonymously(isolated);
    createdUid = temporary.user.uid;
    const credential = await googleCredential(temporary.user, provider);
    verifySession(auth, initialUid);
    await signInWithCredential(auth, credential);
  } finally {
    await disposeIsolated(isolated, createdUid);
  }
}

/** Refuses a late popup result when another tab has replaced or ended the initiating session. */
function verifySession(auth: Auth, initialUid?: string): void {
  if (auth.currentUser?.uid !== initialUid)
    throw new Error(auth.currentUser ? 'auth/session-active' : 'auth/session-ended');
}

/** Uses memory-only credentials and the same validated backend, without profile, chat or presence listeners. */
function isolatedAuth(auth: Auth): Auth {
  const app = initializeApp(auth.app.options, 'google-check-' + crypto.randomUUID());
  const isolated = initializeAuth(app, { persistence: inMemoryPersistence });
  if (auth.emulatorConfig) {
    const { host, port } = auth.emulatorConfig;
    connectAuthEmulator(isolated, `http://${host}:${port}`, { disableWarnings: true });
  }
  isolated.languageCode = 'de';
  return isolated;
}

/** Accepts a newly linked Google identity or a credential already owned by an existing Google account. */
async function googleCredential(
  user: User,
  provider: GoogleAuthProvider,
): Promise<OAuthCredential> {
  try {
    const result = await linkWithPopup(user, provider, browserPopupRedirectResolver);
    return requireCredential(GoogleAuthProvider.credentialFromResult(result));
  } catch (error) {
    return existingGoogleCredential(error);
  }
}

/** Rejects email collisions; only an already-linked Google credential may resume ordinary sign-in. */
function existingGoogleCredential(error: unknown): OAuthCredential {
  if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use')
    throw new Error('auth/account-exists-with-different-credential');
  if (!(error instanceof FirebaseError) || error.code !== 'auth/credential-already-in-use')
    throw error;
  return requireCredential(GoogleAuthProvider.credentialFromError(error));
}

/** Refuses an incomplete popup response before it can replace the application's current session. */
function requireCredential(credential: OAuthCredential | null): OAuthCredential {
  if (!credential || credential.providerId !== 'google.com')
    throw new Error('auth/invalid-google-response');
  return credential;
}

/** Cleans this attempt's anonymous helper and releases the isolated SDK even when remote cleanup is unavailable. */
async function disposeIsolated(auth: Auth, createdUid: string): Promise<void> {
  await removeAnonymousHelper(auth, createdUid);
  await deleteApp(auth.app).catch(() => undefined);
}

/** Rechecks server identity before deletion; a lost link response must never delete a newly linked Google account. */
async function removeAnonymousHelper(auth: Auth, createdUid: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = auth.currentUser;
    if (!isOwnAnonymous(user, createdUid)) return;
    try {
      await reload(user);
      if (isOwnAnonymous(user, createdUid)) await deleteUser(user);
      return;
    } catch (error) {
      if (!retryableCleanup(error)) return;
    }
  }
}

/** Limits cleanup to the UID created by this attempt while it remains anonymous. */
function isOwnAnonymous(user: User | null, createdUid: string): user is User {
  return !!createdUid && user?.uid === createdUid && user.isAnonymous;
}

/** Retries one transient network or server failure; permission errors and permanent outages leave data untouched. */
function retryableCleanup(error: unknown): boolean {
  return (
    error instanceof FirebaseError &&
    ['auth/network-request-failed', 'auth/internal-error'].includes(error.code)
  );
}
