import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { OverlayState } from '../../core/ui/overlay-state';
import { channels, directMessages } from './workspace-items';

/** Lists supplied channel and direct-message examples with expandable sections and preview navigation. */
@Component({
  selector: 'app-workspace-sidebar',
  imports: [Icon, AvatarImage, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-sidebar.html',
  styleUrl: './workspace-sidebar.scss',
})
export class WorkspaceSidebar {
  protected readonly overlay = inject(OverlayState);
  readonly basePath = input.required<string>();
  readonly isOverview = input.required<boolean>();
  protected readonly channels = channels;
  protected readonly directMessages = directMessages;
  protected readonly channelsExpanded = signal(true);
  protected readonly directExpanded = signal(true);
}
