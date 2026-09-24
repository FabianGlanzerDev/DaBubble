import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Brand } from '../../shared/ui/brand';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { OverlayState } from '../../core/ui/overlay-state';
import { WorkspaceSearch } from './workspace-search';
import { AuthSession } from '../../core/auth/auth-session';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-workspace-header',
  imports: [Brand, AvatarImage, Icon, WorkspaceSearch, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header>
    <app-brand [large]="true" [class.conversation-brand]="conversation()" />
    @if (conversation()) {
      <a class="mobile-workspace-back" [routerLink]="basePath()" aria-label="Zurück zum Menü">
        <app-icon name="chevron" /><img
          src="assets/images/original/devspace.svg"
          width="50"
          height="50"
          alt=""
        />Devspace
      </a>
    }
    <app-workspace-search />
    <button
      class="profile"
      type="button"
      (click)="overlay.open('settings', { account: realAccount() })"
      [attr.aria-label]="
        realAccount()
          ? 'Profilmenü für ' + name() + ' öffnen'
          : 'Profilmenü für Beispielprofil Frederik Beck öffnen'
      "
      aria-haspopup="dialog"
    >
      <span>{{ name() }}</span>
      <app-avatar-image
        [index]="realAccount() ? (session.profile()?.avatarId ?? null) : 2"
        [size]="70"
        [presence]="realAccount() ? null : 'active'"
      />
      <app-icon name="chevron" />
    </button>
  </header>`,
  styleUrl: './workspace-header.scss',
})
export class WorkspaceHeader {
  readonly conversation = input(false);
  readonly basePath = input('/vorschau');
  readonly realAccount = input(false);
  protected readonly session = inject(AuthSession);
  protected readonly name = computed(() =>
    this.realAccount() ? (this.session.profile()?.name ?? 'Mein Konto') : 'Frederik Beck',
  );
  protected readonly overlay = inject(OverlayState);
}
