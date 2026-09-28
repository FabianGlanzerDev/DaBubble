import { DOCUMENT } from '@angular/common';
import { afterNextRender, inject, Injectable, Injector, signal } from '@angular/core';
import { MobileNavigation } from '../../core/ui/mobile-navigation';

/** Layout state only. No authentication, message state or persistence. */
@Injectable()
export class WorkspacePreview {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  readonly mobile = inject(MobileNavigation);
  readonly threadOpen = signal(true);
  readonly mobileThreadOpen = signal(false);

  /** Opens the appropriate responsive preview thread and focuses its heading after layout completes. */
  openThread(): void {
    if (this.mobile.isMobile()) this.mobile.open('thread');
    this.threadOpen.set(true);
    this.mobileThreadOpen.set(true);
    afterNextRender(
      () => this.document.defaultView?.requestAnimationFrame(() => this.focusHeading()),
      { injector: this.injector },
    );
  }

  /** Focuses only a visible thread heading so hidden desktop or mobile duplicates are skipped. */
  private focusHeading(): void {
    const headings = this.document.querySelectorAll<HTMLElement>('[data-thread-heading]');
    [...headings].find((heading) => heading.checkVisibility({ checkVisibilityCSS: true }))?.focus();
  }
}
