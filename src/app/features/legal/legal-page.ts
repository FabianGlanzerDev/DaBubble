import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Brand } from '../../shared/ui/brand';
import { Icon } from '../../shared/ui/icon';
import { PrivacyNotice } from './privacy-notice';

/** Selects the maintained imprint or privacy content within the shared responsive legal layout. */
@Component({
  selector: 'app-legal-page',
  imports: [Brand, Icon, RouterLink, PrivacyNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header><app-brand [large]="true" /></header>
    <main id="main-content" tabindex="-1" [class.privacy]="privacy">
      <article>
        <a class="icon-button back" routerLink="/anmeldung" aria-label="Zur Anmeldung"
          ><app-icon name="arrow"
        /></a>
        <h1 data-page-heading tabindex="-1">{{ privacy ? 'Datenschutz' : 'Impressum' }}</h1>
        @if (privacy) {
          <app-privacy-notice />
        } @else {
          <p>Fabian Glanzer<br />Neue Frauengasse 8<br />8750 Judenburg<br />Österreich</p>
          <h2>Kontakt</h2>
          <p>fabsdev@gmx.at</p>
          <p class="note">Abschlussprojekt im Rahmen der Developer Akademie.</p>
        }
      </article>
    </main>`,
  styleUrl: './legal-page.scss',
})
export class LegalPage {
  protected readonly privacy = inject(ActivatedRoute).snapshot.data['privacy'] === true;
}
