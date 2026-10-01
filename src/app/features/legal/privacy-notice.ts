import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeletionProofForm } from './deletion-proof-form';

/** Renders the maintained privacy text separately from the surrounding legal-page layout. */
@Component({
  selector: 'app-privacy-notice',
  imports: [DeletionProofForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy-notice.html',
  styles: `
    :host {
      display: block;
      overflow-wrap: anywhere;
      line-height: 1.35;
    }
    h2 {
      font-size: 24px;
      color: var(--accent);
      line-height: 1.375;
      margin: 32px 0 12px;
    }
    p {
      margin: 0 0 16px;
      line-height: inherit;
    }
    address {
      font-style: normal;
      margin-bottom: 16px;
    }
    ul {
      padding-inline-start: 24px;
      margin: 0 0 16px;
    }
    li + li {
      margin-top: 8px;
    }
    .request-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
    .sources {
      font-size: 16px;
    }
  `,
})
export class PrivacyNotice {
  protected readonly deletionRequestUrl =
    'mailto:fabsdev@gmx.at?subject=' +
    encodeURIComponent('DaBubble – Löschanfrage') +
    '&body=' +
    encodeURIComponent(
      'Hallo Fabian,\n\nich möchte eine Löschanfrage zu DaBubble stellen.\n' +
        'Betroffenes Konto (E-Mail-Adresse):\n' +
        'Betroffene Daten oder Gespräche:\n\n' +
        'Bitte informiere mich über den konkreten Umfang und die Folgen, bevor Daten entfernt werden.\n' +
        'Diese Anfrage bestätigt keine Löschung der Beiträge anderer Personen.\n\n' +
        'Bitte keine Passwörter oder Reset-Links mitsenden.',
    );
}
