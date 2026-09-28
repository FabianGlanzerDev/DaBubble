import { Injectable, signal } from '@angular/core';
import { AccountIdentity } from './user-profile';

/** Serializable setup progress bound to one UID after registration; excludes credentials. */
interface RegistrationDraft {
  uid: string | null;
  email: string;
  name: string;
  avatarId: number | null;
  completed: boolean;
}

const storageKey = 'dabubble.registration.v1';

/** Per-tab, UID-bound setup draft. Never stores passwords or grants access. */
@Injectable({ providedIn: 'root' })
export class RegistrationProgress {
  private readonly draft = signal<RegistrationDraft | null>(this.restore());

  /** Returns setup progress only for its owning, non-anonymous account. */
  forUser(user: AccountIdentity | null): RegistrationDraft | null {
    const draft = this.draft();
    return user && !user.isAnonymous && draft?.uid === user.uid ? draft : null;
  }

  /** Persists the entered identity before creating an account so setup can survive reloads. */
  prepare(email: string, name: string): void {
    this.persist({
      uid: null,
      email: email.trim(),
      name: name.trim(),
      avatarId: null,
      completed: false,
    });
  }

  /** Binds an unclaimed draft only to the matching email/password identity. */
  attach(user: AccountIdentity | null): void {
    const draft = this.draft();
    if (!draft || draft.uid || !user || user.isAnonymous) return;
    if (user.email?.toLowerCase() !== draft.email.toLowerCase()) return;
    if (!user.providerIds.includes('password')) return;
    this.persist({ ...draft, uid: user.uid });
  }

  /** Retains the prior avatar when updating the owning account's unfinished setup. */
  update(user: AccountIdentity | null, name: string, avatarId?: number | null): void {
    const draft = this.forUser(user);
    if (draft)
      this.persist({ ...draft, name, avatarId: avatarId ?? draft.avatarId, completed: false });
  }

  /** Marks persisted setup as complete so reloads can replay the success step. */
  complete(user: AccountIdentity | null): void {
    const draft = this.forUser(user);
    if (draft) this.persist({ ...draft, completed: true });
  }

  /** Discards an unbound draft after failed signup without removing an existing account's progress. */
  cancelPreparation(): void {
    if (!this.draft()?.uid) this.clear();
  }

  /** Removes this tab's setup draft without allowing unavailable storage to prevent logout. */
  clear(): void {
    this.draft.set(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Signing out must remain possible even when browser storage becomes unavailable.
    }
  }

  /** Updates the in-memory draft only after session storage succeeds; rejects unavailable storage. */
  private persist(draft: RegistrationDraft): void {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      this.draft.set(draft);
    } catch {
      throw new Error('registration/storage-unavailable');
    }
  }

  /** Treats missing, malformed or inaccessible session storage as absent setup progress. */
  private restore(): RegistrationDraft | null {
    try {
      const data: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      return validDraft(data) ? data : null;
    } catch {
      return null;
    }
  }
}

/** Validates restored draft fields and name limits before trusting browser storage. */
function validDraft(value: unknown): value is RegistrationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<RegistrationDraft>;
  return (
    (draft.uid === null || typeof draft.uid === 'string') &&
    typeof draft.email === 'string' &&
    typeof draft.name === 'string' &&
    typeof draft.completed === 'boolean' &&
    !!draft.name.trim() &&
    draft.name.trim().length <= 80 &&
    validAvatar(draft.avatarId)
  );
}

/** Accepts an unselected avatar or an integer index into the six supplied illustrations. */
function validAvatar(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5)
  );
}
