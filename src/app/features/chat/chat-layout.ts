import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon } from '../../shared/ui/icon';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceSidebar } from './workspace-sidebar';
import { ThreadPanel } from './thread-panel';
import { WorkspacePreview } from './workspace-preview';
import { AuthSession } from '../../core/auth/auth-session';
import { AccountStatus } from '../auth/account-status';
import { WorkspaceSearch } from './workspace-search';

/** Arranges the explicitly local design preview, with separate responsive menu and thread views. */
@Component({
  selector: 'app-chat-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    Icon,
    WorkspaceHeader,
    WorkspaceSidebar,
    ThreadPanel,
    AccountStatus,
    WorkspaceSearch,
  ],
  providers: [WorkspacePreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-layout.html',
  styleUrls: ['./chat-layout.scss', './guest-banner.scss'],
})
export class ChatLayout {
  protected readonly session = inject(AuthSession);
  private readonly threadSwitch = viewChild<ElementRef<HTMLButtonElement>>('threadSwitch');
  protected readonly preview = inject(WorkspacePreview);
  private readonly router = inject(Router);
  protected readonly basePath = inject(ActivatedRoute).snapshot.data['preview']
    ? '/vorschau'
    : '/chat';
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly hasConversation = computed(
    () => this.currentUrl().split(/[?#]/)[0] !== this.basePath,
  );
  protected readonly menuOpen = signal(true);
  protected readonly mobile = this.preview.mobile;
  protected readonly hasThread = computed(() =>
    this.currentUrl().split(/[?#]/)[0]?.endsWith('/channels/entwicklerteam'),
  );

  /** Resets preview thread visibility from route state without modifying any persisted conversation. */
  constructor() {
    effect(() => {
      this.preview.threadOpen.set(!!this.hasThread());
      this.preview.mobileThreadOpen.set(false);
    });
  }

  /** Mirrors the native details element's open state into the mobile preview layout. */
  protected syncMobileThread(event: Event): void {
    this.preview.mobileThreadOpen.set((event.target as HTMLDetailsElement).open);
  }

  /** Hides the desktop preview thread and returns keyboard focus to its toggle. */
  protected closeThread(): void {
    this.preview.threadOpen.set(false);
    this.threadSwitch()?.nativeElement.focus();
  }

  /** Hides the mobile preview thread and restores the prior history-backed view. */
  protected closeMobileThread(): void {
    this.preview.mobileThreadOpen.set(false);
    this.mobile.close();
  }
}
