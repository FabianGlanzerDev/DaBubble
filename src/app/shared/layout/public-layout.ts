import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../ui/brand';

/** Provides the common brand, main-content landmark and legal navigation around public page content. */
@Component({
  selector: 'app-public-layout',
  imports: [Brand, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="public-layout" [attr.data-variant]="variant()">
    <header>
      <app-brand [large]="true" [style.visibility]="brandVisible() ? 'visible' : 'hidden'" />
    </header>
    <main [id]="mainId()" tabindex="-1"><ng-content /></main>
    @if (showRegistration()) {
      <div class="registration">
        <p>Neu bei DABubble?</p>
        <a routerLink="/registrierung">Konto erstellen</a>
      </div>
    }
    <footer>
      <nav aria-label="Rechtliche Informationen">
        <a routerLink="/impressum">Impressum</a>
        <a routerLink="/datenschutz">Datenschutz</a>
      </nav>
    </footer>
  </div>`,
  styleUrl: './public-layout.scss',
})
export class PublicLayout {
  readonly variant = input('standard');
  readonly brandVisible = input(true);
  readonly showRegistration = input(false);
  readonly mainId = input<string | null>('main-content');
}
