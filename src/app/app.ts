import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { OverlayHost } from './features/overlays/overlay-host';
import { OverlayState } from './core/ui/overlay-state';
import { AuthSession } from './core/auth/auth-session';

/** Hosts routed pages and coordinates accessible focus with dialog and workspace navigation. */
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
    this.document.location.hash.slice(1).split('?')[0] ?? '',
  );
  private readonly injector = inject(Injector);
  private readonly overlays = inject(OverlayState);

  /** Moves keyboard focus to the main landmark without adding a fragment navigation entry. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.document.getElementById('main-content')?.focus();
  }

  /** Observes completed navigation until destruction so focus follows the newly rendered route. */
  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.focusPage());
  }

  /** Lets mobile dialog history restore its context before closing stale overlays and focusing the page. */
  private focusPage(): void {
    if (this.overlays.syncNavigation()) return;
    if (this.overlays.current()) this.overlays.closeForNavigation();
    afterNextRender(() => this.focusDestination(), { injector: this.injector });
  }

  /** Prefers visible search or composer controls, otherwise focusing the first visible page heading. */
  private focusDestination(): void {
    if (this.focusMobileSearch() || this.focusLiveComposer()) return;
    const target = this.document.querySelector<HTMLElement>('#message-draft, #recipient-search');
    if (this.document.documentElement.clientWidth >= 768 && target?.checkVisibility()) {
      target.focus({ preventScroll: true });
      return;
    }
    const headings = this.document.querySelectorAll<HTMLElement>('[data-page-heading]');
    [...headings].find((heading) => heading.checkVisibility())?.focus();
  }

  /** Focuses the visible live message editor without scrolling the current conversation. */
  private focusLiveComposer(): boolean {
    const fields = this.document.querySelectorAll<HTMLTextAreaElement>(
      '#thread-message, #chat-message',
    );
    const field = [...fields].reverse().find((element) => element.checkVisibility());
    if (!field) return false;
    field.focus({ preventScroll: true });
    return true;
  }

  /** Preserves focus in a visible mobile search field rather than moving it to the page heading. */
  private focusMobileSearch(): boolean {
    const search = this.document.querySelector<HTMLInputElement>(
      '.mobile-expanded input, #mobile-live-search:focus',
    );
    if (!search?.checkVisibility()) return false;
    search.focus({ preventScroll: true });
    return true;
  }
}
