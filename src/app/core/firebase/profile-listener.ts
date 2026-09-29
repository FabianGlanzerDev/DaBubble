import { Firestore, DocumentSnapshot, doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, readUserProfile } from '../auth/user-profile';

/** Receives validated private-profile changes or an explicit listener failure. */
export interface ProfileObserver {
  next: (profile: UserProfile | null) => void;
  error: (error: unknown) => void;
}

/** Keeps malformed server data from escaping the listener as an unhandled browser exception. */
function receiveProfile(snapshot: DocumentSnapshot, observer: ProfileObserver): void {
  try {
    observer.next(snapshot.exists() ? readUserProfile(snapshot.data(), snapshot.id) : null);
  } catch (error) {
    observer.error(error);
  }
}

/** Observes only the authenticated account's private profile and reports malformed or denied data safely. */
export function observeProfile(
  database: Firestore,
  uid: string,
  observer: ProfileObserver,
): () => void {
  return onSnapshot(
    doc(database, 'users', uid),
    (snapshot) => receiveProfile(snapshot, observer),
    observer.error,
  );
}
