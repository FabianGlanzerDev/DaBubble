import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Brand } from '../../shared/ui/brand';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-legal-page',
  imports: [Brand, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header><app-brand [large]="true" /></header>
    <main id="main-content" tabindex="-1" [class.privacy]="privacy">
      <article>
        <a class="icon-button back" routerLink="/anmeldung" aria-label="Zur Anmeldung"
          ><app-icon name="arrow"
        /></a>
        <h1 data-page-heading tabindex="-1">{{ privacy ? 'Datenschutz' : 'Impressum' }}</h1>
        @if (privacy) {
          <h2>Inhalt ausstehend</h2>
          <p>
            Die Figma-Vorlage enthält hier ausschließlich Blindtext. Eine auf den tatsächlichen
            Betrieb abgestimmte Datenschutzerklärung liegt noch nicht vor.
          </p>
          <h2>Vor Veröffentlichung zu ergänzen</h2>
          <p>
            Angaben zum Verantwortlichen, zur eingesetzten Datenverarbeitung, zu Dienstleistern und
            zu Kontaktmöglichkeiten fehlen noch. Diese Seite ist eine Layout-Vorschau.
          </p>
        } @else {
          <p>[Name des Betreibers]<br />[Anschrift]<br />[Postleitzahl und Ort]</p>
          <h2>Kontakt</h2>
          <p>[E-Mail-Adresse]</p>
          <p class="note">Layout-Vorschau · Die verbindlichen Betreiberangaben fehlen noch.</p>
        }
      </article>
    </main>`,
  styles: `
    header {
      position: absolute;
      inset: 25px 50px auto;
    }
    main {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 150px 24px;
    }
    article {
      width: min(100%, 676px);
      padding: 48px 56px;
      background: white;
      border-radius: 30px;
      box-shadow: 0 2px 10px #0001;
      font-size: 20px;
    }
    h1 {
      font-size: 46px;
      color: var(--accent);
      margin: 40px 0 16px;
    }
    h2 {
      font-size: 32px;
      color: var(--accent);
      margin: 50px 0 12px;
    }
    p {
      margin: 0;
      line-height: 1.4;
    }
    .note {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 24px;
    }
    .back {
      color: var(--text);
    }
    .privacy {
      place-items: start center;
      padding-top: 120px;
    }
    .privacy article {
      width: min(100%, 1312px);
      background: transparent;
      box-shadow: none;
      padding: 0;
    }
    .privacy h1 {
      margin: 16px 0 24px;
    }
    .privacy h2 {
      font-size: 24px;
      margin: 30px 0 12px;
    }
    @media (max-width: 767px) {
      :host {
        display: block;
        background: white;
        min-height: 100dvh;
      }
      header {
        position: static;
        padding: 16px;
        min-height: 80px;
        background: var(--page);
        --mobile-brand-size: 45px;
        --mobile-brand-font: 22px;
      }
      main,
      .privacy {
        min-height: 0;
        padding: 40px 16px;
      }
      article {
        padding: 24px;
      }
      h1 {
        font-size: clamp(32px, 10.7vw, 46px);
      }
      h2 {
        font-size: 26px;
      }
      p {
        font-size: 17px;
      }
      .privacy article {
        padding: 16px;
      }
    }
  `,
})
export class LegalPage {
  protected readonly privacy = inject(ActivatedRoute).snapshot.data['privacy'] === true;
}
