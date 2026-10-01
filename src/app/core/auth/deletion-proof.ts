import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/** Stores the operator's one-time challenge privately; this proves UID control without granting deletion authority. */
export async function saveDeletionProof(
  db: Firestore,
  uid: string,
  challenge: string,
): Promise<void> {
  if (!/^[a-f0-9]{32}$/.test(challenge)) throw new Error('invalid-proof');
  await setDoc(doc(db, 'deletionProofs', uid), { challenge, updatedAt: serverTimestamp() });
}
