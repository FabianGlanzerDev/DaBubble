import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OverlayState } from '../../core/ui/overlay-state';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { chatEmojis } from '../../core/chat/chat-models';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { LiveChannelDialog } from './live-channel-dialog';
import { LiveMembersDialog } from './live-members-dialog';

@Component({
  selector: 'app-live-dialog',
  imports: [AvatarImage, LiveChannelDialog, LiveMembersDialog],
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
      @case ('profile') {
        <div class="person">
          <app-avatar-image [index]="person().avatarId" [size]="160" />
          <h3>{{ person().name }}</h3>
          <button class="button" type="button" [disabled]="action.busy()" (click)="direct()">
            Nachricht
          </button>
        </div>
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
    }
    @if (action.error()) {
      <p class="action-error" role="alert">{{ action.error() }}</p>
    }`,
  styles: `
    .person {
      display: grid;
      justify-items: center;
      gap: 24px;
    }
    h3 {
      font-size: 28px;
      margin: 0;
      overflow-wrap: anywhere;
    }
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
  private readonly nav = inject(ChatNavigation);
  protected readonly action = new ChatAction();
  protected readonly emojis = chatEmojis;
  protected readonly reactions = computed(() =>
    (this.store.reactions()[this.overlay.current()?.channelId ?? ''] ?? []).filter(
      (item) => item.messageId === this.overlay.current()?.messageId,
    ),
  );
  protected readonly person = computed(() =>
    this.store.person(this.overlay.current()?.personId ?? ''),
  );

  protected choose(emoji: string): void {
    this.overlay.current()?.onEmoji?.(emoji);
    this.overlay.close();
  }

  protected direct(): void {
    void this.action.run(async () => {
      await this.nav.direct(this.person().uid);
      if (this.overlay.current()) this.overlay.close();
    });
  }
}
