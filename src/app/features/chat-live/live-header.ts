import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../../shared/ui/brand';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { OverlayState } from '../../core/ui/overlay-state';
import { AuthSession } from '../../core/auth/auth-session';
import { LiveSearch } from './live-search';

@Component({
  selector: 'app-live-header',
  imports: [Brand, AvatarImage, Icon, RouterLink, LiveSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header>
    <app-brand [large]="true" [class.conversation-brand]="conversation()" />
    @if (conversation()) {
      <a class="mobile-workspace-back" routerLink="/chat" aria-label="Zurück zum Menü">
        <app-icon name="chevron" /><img
          src="assets/images/original/devspace.svg"
          width="50"
          height="50"
          alt=""
        />Devspace
      </a>
    }
    <app-live-search class="desktop-search" />
    <button
      class="profile"
      type="button"
      (click)="overlay.open('settings', { account: true })"
      [attr.aria-label]="'Profilmenü für ' + (session.profile()?.name ?? 'Mein Konto') + ' öffnen'"
      aria-haspopup="dialog"
    >
      <span>{{ session.profile()?.name ?? 'Mein Konto' }}</span>
      <app-avatar-image [index]="session.profile()?.avatarId ?? null" [size]="70" /><app-icon
        name="chevron"
      />
    </button>
  </header>`,
  styleUrls: ['../chat/workspace-header.scss', './live-header.scss'],
})
export class LiveHeader {
  readonly conversation = input(false);
  protected readonly session = inject(AuthSession);
  protected readonly overlay = inject(OverlayState);
}
