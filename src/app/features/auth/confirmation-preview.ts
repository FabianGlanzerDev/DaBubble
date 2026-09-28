import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';
import { ConfirmationMessage } from '../../shared/ui/confirmation-message';
import { OverlayState } from '../../core/ui/overlay-state';

/** Demonstrates Figma confirmation variants without requesting email or changing authentication data. */
@Component({
  selector: 'app-confirmation-preview',
  imports: [PublicLayout, RouterLink, ConfirmationMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-public-layout
    ><section class="gallery" aria-labelledby="preview-title">
      <p class="eyebrow">Designvorschau</p>
      <h1 id="preview-title" data-page-heading tabindex="-1">Bestätigungs<wbr />meldungen</h1>
      <p class="preview-explanation">
        Dies sind ausschließlich Gestaltungsbeispiele. Es wurde kein Konto erstellt, keine E-Mail
        gesendet und kein Passwort geändert.
      </p>
      <figure>
        <figcaption>Vorlage „03B-Overlay One“</figcaption>
        <app-confirmation-message kind="account" />
        <button class="text-button" (click)="overlay.open('confirmation', { kind: 'account' })">
          Konto-Overlay animieren
        </button>
      </figure>
      <figure>
        <figcaption>Vorlage „04B-Overlay Two“</figcaption>
        <app-confirmation-message kind="email" />
        <button class="text-button" (click)="overlay.open('confirmation', { kind: 'email' })">
          E-Mail-Overlay animieren
        </button>
      </figure>
      <figure>
        <figcaption>Vorlage „05B-Overlay Three“</figcaption>
        <app-confirmation-message kind="signin" />
        <button class="text-button" (click)="overlay.open('confirmation', { kind: 'signin' })">
          Anmelden-Overlay animieren
        </button>
      </figure>
      <nav aria-label="Zurück zu den Ansichten">
        <a routerLink="/passwort-reset">Zur Passwort-Vorschau</a
        ><a routerLink="/anmeldung">Zur Anmeldung</a>
      </nav>
    </section></app-public-layout
  >`,
  styles: `
    .gallery {
      width: min(100%, 860px);
      padding: 40px;
      border-radius: 30px;
      background: white;
    }
    h1 {
      color: var(--accent);
      font-size: clamp(26px, 4vw, 36px);
      margin: 16px 0;
    }
    .eyebrow {
      margin: 0;
    }
    .preview-explanation {
      color: var(--text-secondary);
      font-size: 16px;
    }
    figure {
      margin: 32px 0;
    }
    figcaption {
      color: var(--text-secondary);
      margin-bottom: 12px;
      font-size: 14px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
    }
    nav a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
    @media (max-width: 767px) {
      .gallery {
        padding: 24px 20px;
      }
    }
  `,
})
export class ConfirmationPreview {
  protected readonly overlay = inject(OverlayState);
}
