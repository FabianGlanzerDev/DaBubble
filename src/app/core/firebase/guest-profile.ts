import { Firestore, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { UserProfile, readUserProfile } from '../auth/user-profile';

/** Create only when absent; restored sessions and concurrent tabs retain all profile edits. */
export function loadGuestProfile(database: Firestore, uid: string): Promise<UserProfile> {
  const reference = doc(database, 'users', uid);
  return runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) return readUserProfile(snapshot.data(), uid);
    const profile = { uid, name: 'Gast ' + uid.slice(0, 6), avatarId: 0 };
    transaction.set(reference, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return profile;
  });
}
