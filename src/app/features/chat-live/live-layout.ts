import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { Icon } from '../../shared/ui/icon';
import { AccountStatus } from '../auth/account-status';
import { LiveHeader } from './live-header';
import { LiveSidebar } from './live-sidebar';
import { LiveSearch } from './live-search';
import { LiveConversation } from './live-conversation';
import { MobileNavigation } from '../../core/ui/mobile-navigation';

/** Arranges real sidebar, conversation and thread views with responsive account and loading states. */
@Component({
  selector: 'app-live-layout',
  imports: [
    RouterLink,
    RouterOutlet,
    Icon,
    AccountStatus,
    LiveHeader,
    LiveSidebar,
    LiveSearch,
    LiveConversation,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-layout.html',
  styleUrls: ['../chat/chat-layout.scss', './live-layout.scss'],
  host: { '(window:resize)': 'narrow.set(windowNarrow())' },
})
export class LiveLayout {
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  protected readonly mobile = inject(MobileNavigation);
  private readonly menuRequested = signal(true);
  protected readonly narrow = signal(this.windowNarrow());
  protected readonly menuOpen = computed(
    () => this.menuRequested() && !(this.narrow() && this.nav.threadId()),
  );

  /** Detects the width at which the workspace and thread cannot share three usable columns. */
  protected windowNarrow(): boolean {
    return window.innerWidth < 1200;
  }

  /** Gives the workspace priority when reopening it beside a narrow conversation, preserving thread drafts. */
  protected toggleMenu(): void {
    if (this.narrow() && this.nav.threadId()) {
      this.menuRequested.set(true);
      this.nav.closeThread();
    } else this.menuRequested.set(!this.menuRequested());
  }
}
