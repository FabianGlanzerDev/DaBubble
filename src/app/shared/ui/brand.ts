import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Renders the shared DaBubble logo with a route back through the intro animation. */
@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.large]': 'large()' },
  template: `<a
    routerLink="/intro"
    [queryParams]="{ replay: true }"
    aria-label="DaBubble – Intro erneut abspielen"
  >
    <img src="assets/images/original/logo-solo.png" width="70" height="70" alt="" />
    <span>DABubble</span>
  </a>`,
  styles: `
    a {
      display: inline-flex;
      gap: var(--brand-gap, 0.9rem);
      align-items: center;
      color: var(--text);
      text-decoration: none;
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1;
    }
    img {
      flex-shrink: 0;
      width: 42px;
      height: 42px;
    }
    :host(.large) a {
      font-size: 32px;
    }
    :host(.large) img {
      width: 70px;
      height: 70px;
    }
    @media (max-width: 767px) {
      :host {
        display: inline-flex;
      }
      :host(.large) a {
        font-size: var(--mobile-brand-font, 28px);
      }
      :host(.large) img {
        width: var(--mobile-brand-size, 56px);
        height: var(--mobile-brand-size, 56px);
      }
    }
  `,
})
export class Brand {
  readonly large = input(false);
}
