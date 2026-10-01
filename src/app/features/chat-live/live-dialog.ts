import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OverlayState } from '../../core/ui/overlay-state';
import { ChatStore } from '../../core/chat/chat-store';
import { chatEmojis } from '../../core/chat/chat-models';
import { LiveProfileDialog } from './live-profile-dialog';
import { LiveChannelDialog } from './live-channel-dialog';
import { LiveMembersDialog } from './live-members-dialog';

/** Dispatches real-chat overlay content and connects shared pickers to the initiating chat action. */
@Component({
  selector: 'app-live-dialog',
  imports: [LiveProfileDialog, LiveChannelDialog, LiveMembersDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@switch (overlay.current()?.type) {
    @case ('channel-create') {
      <app-live-channel-dialog />
    }
    @case ('channel') {
      <app-live-channel-dialog />
    }
    @case ('members') {
      <app-live-members-dialog />
    }
    @case ('add-members') {
      <app-live-members-dialog />
    }
    @case ('channel-people') {
      <app-live-members-dialog />
    }
    @case ('profile') {
      <app-live-profile-dialog />
    }
    @case ('emoji') {
      <div class="emojis">
        @for (emoji of emojis; track emoji) {
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="'Emoji ' + emoji"
            (click)="choose(emoji)"
          >
            {{ emoji }}
          </button>
        }
      </div>
    }
    @case ('reactions') {
      @for (item of reactions(); track item.id) {
        <p>{{ item.emojis.join(' ') }} · {{ store.person(item.userId).name }}</p>
      } @empty {
        <p>Keine Reaktionen vorhanden.</p>
      }
    }
  }`,
  styles: `
    .emojis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
      gap: 12px;
    }
    .emojis button {
      font-size: 26px;
    }
  `,
})
export class LiveDialog {
  protected readonly overlay = inject(OverlayState);
  protected readonly store = inject(ChatStore);
  protected readonly emojis = chatEmojis;
  protected readonly reactions = computed(() =>
    (this.store.reactions()[this.overlay.current()?.channelId ?? ''] ?? []).filter(
      (item) => item.messageId === this.overlay.current()?.messageId,
    ),
  );

  /** Delivers the selected emoji to the opening action before dismissing the picker. */
  protected choose(emoji: string): void {
    this.overlay.current()?.onEmoji?.(emoji);
    this.overlay.close();
  }
}
