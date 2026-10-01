import { DOCUMENT, Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { OverlayContext } from './overlay-state';

/** One history entry per mobile dialog; transitions inside that dialog replace it. */
@Injectable({ providedIn: 'root' })
export class MobileOverlayHistory {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly contexts = new Map<string, OverlayContext>();
  private sequence = 0;
  private origin = '';

  /** Stores mobile dialog context behind a history key, replacing transitions within an open dialog. */
  open(context: OverlayContext): void {
    if (this.document.documentElement.clientWidth >= 768) return;
    const tree = this.router.parseUrl(this.router.url);
    const searchOpen = tree.queryParams['view'] === 'search';
    const replaceUrl = !!tree.queryParams['dialog'] || searchOpen;
    if (searchOpen) delete tree.queryParams['view'];
    const key = String(++this.sequence);
    this.origin = this.router.url.split('?')[0] ?? '';
    this.contexts.set(key, context);
    tree.queryParams['dialog'] = key;
    void this.router.navigateByUrl(tree, { replaceUrl, state: { mobileDialog: true } });
  }

  /** Resolves only in-memory dialog context previously created by this browser page. */
  read(): OverlayContext | undefined {
    return this.contexts.get(String(this.router.parseUrl(this.router.url).queryParams['dialog']));
  }

  /** Checks whether the current route still belongs to the page that opened the dialog. */
  samePage(): boolean {
    return this.origin === this.router.url.split('?')[0];
  }

  /** Closes a history-backed dialog with browser back or removes an externally supplied dialog parameter. */
  dismiss(): boolean {
    const tree = this.router.parseUrl(this.router.url);
    if (!tree.queryParams['dialog']) return false;
    if ((this.location.getState() as { mobileDialog?: boolean }).mobileDialog) this.location.back();
    else {
      delete tree.queryParams['dialog'];
      void this.router.navigateByUrl(tree, { replaceUrl: true });
    }
    return true;
  }
}
