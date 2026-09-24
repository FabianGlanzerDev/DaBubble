import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayState, OverlayType } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';
import { ProfilePanel } from './profile-panel';
import { ChannelPanel } from './channel-panel';
import { MembersPanel } from './members-panel';
import { EmojiPanel } from './emoji-panel';
import { ConfirmationMessage } from '../../shared/ui/confirmation-message';
import { ReactionList } from '../chat/reaction-list';
import { AuthSession } from '../../core/auth/auth-session';
import { authIssue } from '../../core/auth/auth-errors';

const titles: Record<OverlayType, string> = {
  confirmation: 'Animationsbeispiel',
  settings: 'Profilmenü',
  profile: 'Profil',
  'profile-edit': 'Dein Profil bearbeiten',
  avatar: 'Wähle deinen Avatar',
  channel: 'Entwicklerteam',
  'channel-create': 'Channel erstellen',
  'channel-people': 'Leute hinzufügen',
  members: 'Mitglieder',
  'add-members': 'Leute hinzufügen',
  emoji: 'Emojis',
  reactions: 'Beispielreaktionen',
};

@Component({
  selector: 'app-overlay-host',
  imports: [
    Icon,
    ProfilePanel,
    ChannelPanel,
    MembersPanel,
    EmojiPanel,
    ConfirmationMessage,
    ReactionList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overlay-host.html',
  styleUrl: './overlay-host.scss',
})
export class OverlayHost {
  protected readonly session = inject(AuthSession);
  protected readonly logoutError = signal('');
  protected readonly exampleReactions = ['🤓', '✅', '👍', '🚀', '■', '■', '■', '■', '■', '■'];
  protected readonly overlay = inject(OverlayState);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly title = computed(() => {
    const current = this.overlay.current();
    return current?.type === 'channel' && current.channelId === 'office-team'
      ? 'Office-team'
      : titles[current?.type ?? 'settings'];
  });

  constructor() {
    afterRenderEffect(() => this.syncDialog());
  }

  protected async logout(): Promise<void> {
    if (this.session.busy()) return;
    this.logoutError.set('');
    try {
      await this.session.logout();
      this.overlay.close();
    } catch (error) {
      this.logoutError.set(authIssue(error).message);
    }
  }

  private syncDialog(): void {
    const dialog = this.dialog().nativeElement;
    if (this.overlay.current() && !dialog.open) dialog.showModal();
    if (!this.overlay.current() && dialog.open) {
      dialog.close();
      this.overlay.restoreFocus();
    }
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    this.overlay.close();
  }

  protected backdrop(event: PointerEvent): void {
    const dialog = this.dialog().nativeElement;
    const rect = dialog.getBoundingClientRect();
    if (event.target !== dialog) return;
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.overlay.close();
  }
}
