import { DOCUMENT, Location } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MobileNavigation {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly view = computed(
    () => this.router.parseUrl(this.url()).queryParams['view'] as string | undefined,
  );

  isMobile(): boolean {
    return this.document.documentElement.clientWidth < 768;
  }

  open(view: 'thread' | 'search'): void {
    if (this.view() === view) return;
    const tree = this.router.parseUrl(this.router.url);
    tree.queryParams['view'] = view;
    void this.router.navigateByUrl(tree, { state: { mobileView: view } });
  }

  close(): void {
    if (!this.view()) return;
    if ((this.location.getState() as { mobileView?: string }).mobileView === this.view()) {
      this.location.back();
      return;
    }
    const tree = this.router.parseUrl(this.router.url);
    delete tree.queryParams['view'];
    void this.router.navigateByUrl(tree, { replaceUrl: true });
  }
}
