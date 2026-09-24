import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { channels, directMessages } from './workspace-items';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { MessagePreview } from './message-preview';
import { MessageComposer } from './message-composer';
import { channelMessages } from './preview-messages';
import { WorkspacePreview } from './workspace-preview';
import { OverlayState } from '../../core/ui/overlay-state';

@Component({
  selector: 'app-conversation',
  imports: [Icon, RouterLink, AvatarImage, MessagePreview, MessageComposer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conversation.html',
  styleUrl: './conversation.scss',
})
export class Conversation {
  protected readonly overlay = inject(OverlayState);
  protected readonly preview = inject(WorkspacePreview);
  protected readonly messages = channelMessages;
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly isChannel = this.route.snapshot.data['kind'] === 'channel';
  protected readonly item = computed(() =>
    (this.isChannel ? channels : directMessages).find(
      (entry) => entry.id === this.params().get('id'),
    ),
  );
  protected readonly basePath = this.route.parent?.snapshot.data['preview'] ? '/vorschau' : '/chat';

  protected openDetails(): void {
    this.overlay.open(this.isChannel ? 'channel' : 'profile', {
      channelId: this.item()?.id,
      personId: this.item()?.id,
    });
  }
}
