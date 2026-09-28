import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';

/** Provides a navigable fallback for unknown client routes instead of presenting a blank application. */
@Component({
  selector: 'app-not-found',
  imports: [PublicLayout, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-public-layout
    ><section>
      <p class="eyebrow">404</p>
      <h1 data-page-heading tabindex="-1">Seite nicht gefunden</h1>
      <p class="muted">Unter dieser Adresse gibt es keine Ansicht.</p>
      <a class="button" routerLink="/intro">Zur Startseite</a>
    </section></app-public-layout
  >`,
  styles: `
    section {
      text-align: center;
      max-width: 36rem;
    }
  `,
})
export class NotFound {}
