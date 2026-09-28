import { Injectable, signal } from '@angular/core';
import { AccountIdentity } from './user-profile';

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

  forUser(user: AccountIdentity | null): RegistrationDraft | null {
    const draft = this.draft();
    return user && !user.isAnonymous && draft?.uid === user.uid ? draft : null;
  }

  prepare(email: string, name: string): void {
    this.persist({
      uid: null,
      email: email.trim(),
      name: name.trim(),
      avatarId: null,
      completed: false,
    });
  }

  attach(user: AccountIdentity | null): void {
    const draft = this.draft();
    if (!draft || draft.uid || !user || user.isAnonymous) return;
    if (user.email?.toLowerCase() !== draft.email.toLowerCase()) return;
    if (!user.providerIds.includes('password')) return;
    this.persist({ ...draft, uid: user.uid });
  }

  update(user: AccountIdentity | null, name: string, avatarId?: number | null): void {
    const draft = this.forUser(user);
    if (draft)
      this.persist({ ...draft, name, avatarId: avatarId ?? draft.avatarId, completed: false });
  }

  complete(user: AccountIdentity | null): void {
    const draft = this.forUser(user);
    if (draft) this.persist({ ...draft, completed: true });
  }

  cancelPreparation(): void {
    if (!this.draft()?.uid) this.clear();
  }

  clear(): void {
    this.draft.set(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Signing out must remain possible even when browser storage becomes unavailable.
    }
  }

  private persist(draft: RegistrationDraft): void {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      this.draft.set(draft);
    } catch {
      throw new Error('registration/storage-unavailable');
    }
  }

  private restore(): RegistrationDraft | null {
    try {
      const data: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      return validDraft(data) ? data : null;
    } catch {
      return null;
    }
  }
}

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

function validAvatar(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5)
  );
}
