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

  open(context: OverlayContext): void {
    if (this.document.documentElement.clientWidth >= 768) return;
    const tree = this.router.parseUrl(this.router.url);
    const replaceUrl = !!tree.queryParams['dialog'];
    const key = String(++this.sequence);
    this.origin = this.router.url.split('?')[0] ?? '';
    this.contexts.set(key, context);
    tree.queryParams['dialog'] = key;
    void this.router.navigateByUrl(tree, { replaceUrl, state: { mobileDialog: true } });
  }

  read(): OverlayContext | undefined {
    return this.contexts.get(String(this.router.parseUrl(this.router.url).queryParams['dialog']));
  }

  samePage(): boolean {
    return this.origin === this.router.url.split('?')[0];
  }

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
