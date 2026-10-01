import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';

/** Records an operator-issued challenge while the account is still authenticated, without changing its profile. */
@Component({
  selector: 'app-deletion-proof-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (session.user(); as user) {
    <details>
      <summary>Kontoinhaberschaft für eine Löschanfrage nachweisen</summary>
      <p>
        Deine Benutzerkennung: <code>{{ user.uid }}</code>
      </p>
      <p>
        Fordere zuerst per E-Mail einen einmaligen Prüfwert beim Betreiber an. Trage ausschließlich
        diesen Prüfwert ein, kein Passwort oder Sitzungstoken. Das speichert einen privaten Nachweis
        und löscht noch keine Daten.
      </p>
      <form novalidate (submit)="$event.preventDefault(); save()">
        <label for="deletion-challenge">Prüfwert vom Betreiber (32 Zeichen)</label>
        <input
          id="deletion-challenge"
          [value]="challenge()"
          (input)="change($event)"
          autocomplete="off"
          maxlength="32"
          spellcheck="false"
          [disabled]="busy()"
          aria-describedby="deletion-proof-status"
        />
        <button type="submit" class="button" [disabled]="busy() || !valid()">
          {{ busy() ? 'Wird gespeichert…' : 'Prüfwert hinterlegen' }}
        </button>
        <p id="deletion-proof-status" role="status">{{ feedback() }}</p>
      </form>
    </details>
  }`,
  styles: `
    details {
      margin: 16px 0;
      border: 1px solid var(--accent);
      padding: 16px;
      border-radius: 16px;
    }
    summary {
      cursor: pointer;
    }
    p {
      margin: 16px 0;
    }
    code {
      overflow-wrap: anywhere;
    }
    form {
      display: grid;
      gap: 12px;
    }
    input {
      min-width: 0;
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid var(--accent);
    }
    button {
      justify-self: start;
      white-space: normal;
    }
  `,
})
export class DeletionProofForm {
  protected readonly session = inject(AuthSession);
  protected readonly challenge = signal('');
  protected readonly busy = signal(false);
  protected readonly feedback = signal('');

  /** Clears the challenge and feedback when a different account becomes active in this or another tab. */
  constructor() {
    effect(() => {
      this.session.user();
      this.challenge.set('');
      this.feedback.set('');
    });
  }

  /** Accepts only the operator's random hexadecimal challenge, never arbitrary credentials or personal text. */
  protected valid(): boolean {
    return /^[a-f0-9]{32}$/.test(this.challenge());
  }

  /** Normalizes pasted challenge text without persisting it in browser storage. */
  protected change(event: Event): void {
    this.challenge.set((event.target as HTMLInputElement).value.trim().toLowerCase());
    this.feedback.set('');
  }

  /** Prevents duplicate writes and leaves failed requests retryable without claiming a completed deletion. */
  protected async save(): Promise<void> {
    const uid = this.session.user()?.uid;
    if (!uid || !this.valid() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.persist(uid, this.challenge());
    } catch {
      if (this.session.user()?.uid === uid)
        this.feedback.set('Prüfwert nicht gespeichert. Bitte prüfe Verbindung und Anmeldung.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Shows success only to the same identity after its private proof has reached Firestore. */
  private async persist(uid: string, challenge: string): Promise<void> {
    const { saveDeletionProof } = await import('../../core/auth/deletion-proof');
    await saveDeletionProof(await this.session.chatDatabase(), uid, challenge);
    if (this.session.user()?.uid !== uid) return;
    this.challenge.set('');
    this.feedback.set(
      'Prüfwert hinterlegt. Bitte informiere den Betreiber per E-Mail. Es wurden keine Konten oder Chatdaten gelöscht.',
    );
  }
}
