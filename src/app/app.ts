import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { OverlayHost } from './features/overlays/overlay-host';
import { OverlayState } from './core/ui/overlay-state';
import { AuthSession } from './core/auth/auth-session';

@Component({
  imports: [RouterOutlet, OverlayHost],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  protected readonly session = inject(AuthSession);
  protected readonly restoringRoute = /^\/(?:chat|avatar-auswahl)(?:\/|$)/.test(
    this.document.location.pathname,
  );
  private readonly injector = inject(Injector);
  private readonly overlays = inject(OverlayState);

  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.document.getElementById('main-content')?.focus();
  }

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.focusPage());
  }

  private focusPage(): void {
    if (this.overlays.syncNavigation()) return;
    if (this.overlays.current()) this.overlays.closeForNavigation();
    afterNextRender(() => this.focusDestination(), { injector: this.injector });
  }

  private focusDestination(): void {
    if (this.focusMobileSearch()) return;
    const target = this.document.querySelector<HTMLElement>('#message-draft, #recipient-search');
    if (this.document.documentElement.clientWidth >= 768 && target?.checkVisibility()) {
      target.focus({ preventScroll: true });
      return;
    }
    const headings = this.document.querySelectorAll<HTMLElement>('[data-page-heading]');
    [...headings].find((heading) => heading.checkVisibility())?.focus();
  }

  private focusMobileSearch(): boolean {
    const search = this.document.querySelector<HTMLInputElement>('.mobile-expanded input');
    if (!search?.checkVisibility()) return false;
    search.focus({ preventScroll: true });
    return true;
  }
}
