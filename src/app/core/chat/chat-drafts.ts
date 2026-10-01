import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthSession } from '../auth/auth-session';
import { MessageDraft } from './message-mentions';

/** Retains separate room/thread drafts across view changes, clearing them whenever the account changes. */
@Injectable({ providedIn: 'root' })
export class ChatDrafts {
  private readonly session = inject(AuthSession);
  private readonly drafts = signal<Record<string, MessageDraft>>({});
  private currentUid: string | undefined;

  /** Clears in-memory drafts on logout or account switching without persisting message text in browser storage. */
  constructor() {
    effect(() => {
      const uid = this.session.user()?.uid;
      if (uid !== this.currentUid) this.drafts.set({});
      this.currentUid = uid;
    });
  }

  /** Retrieves the draft for one conversation and optional thread. */
  get(key: string): MessageDraft {
    return this.drafts()[key] ?? { text: '', mentions: [] };
  }

  /** Replaces one draft without disturbing other conversations. */
  set(key: string, draft: MessageDraft): void {
    this.drafts.update((all) => ({ ...all, [key]: draft }));
  }
}
