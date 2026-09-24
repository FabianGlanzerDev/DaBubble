import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { Icon } from '../../shared/ui/icon';
import { AccountStatus } from '../auth/account-status';
import { LiveHeader } from './live-header';
import { LiveSidebar } from './live-sidebar';
import { LiveSearch } from './live-search';
import { LiveConversation } from './live-conversation';

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
})
export class LiveLayout {
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  protected readonly menuOpen = signal(true);
}
