import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { ChatMessage } from '../../core/chat/chat-models';
import { OverlayState } from '../../core/ui/overlay-state';

/** Groups real per-user emoji selections into accessible reaction counts and participant details. */
@Component({
  selector: 'app-live-reactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.own]': 'own()' },
  template: `<div class="reactions" [class.expanded]="expanded()" [class.compact]="compact()">
      @for (reaction of items(); track reaction.emoji; let i = $index) {
        <button
          type="button"
          [class.overflow-reaction]="i >= 7"
          [attr.aria-pressed]="reaction.mine"
          [title]="reaction.names.join(', ')"
          [attr.aria-label]="reaction.emoji + ': ' + reaction.names.join(', ')"
          [disabled]="action.busy() || readonly()"
          (click)="toggle(reaction.emoji)"
        >
          {{ reaction.emoji }} {{ reaction.names.length }}
        </button>
      }
      @if (items().length > 7) {
        <button
          class="more-reactions"
          type="button"
          [attr.aria-expanded]="expanded()"
          (click)="expanded.set(!expanded())"
        >
          {{ expanded() ? 'Weniger' : '+' + (items().length - 7) + ' weitere' }}
        </button>
      }
    </div>
    @if (items().length) {
      <button type="button" class="reaction-people" (click)="people()">Wer hat reagiert?</button>
    }
    @if (action.error()) {
      <p class="action-error" role="alert">{{ action.error() }}</p>
    }`,
  styles: `
    :host(.own) {
      display: block;
      text-align: right;
    }
    :host(.own) .reactions {
      justify-content: flex-end;
    }
    .reactions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    button {
      border: 1px solid #adb0d9;
      border-radius: 20px;
      background: white;
      padding: 5px 12px;
      min-height: 36px;
    }
    button:hover,
    button[aria-pressed='true'] {
      background: var(--page);
      border-color: var(--accent);
    }
    .more-reactions {
      display: none;
    }
    .reaction-people {
      font-size: 12px;
      border: 0;
      color: var(--accent);
      padding: 4px 0;
      background: transparent;
    }
    .compact:not(.expanded) .overflow-reaction {
      display: none;
    }
    .compact .more-reactions {
      display: block;
    }
    @media (max-width: 767px) {
      .reactions:not(.expanded) .overflow-reaction {
        display: none;
      }
      .more-reactions {
        display: block;
      }
      button {
        min-height: 44px;
      }
    }
  `,
})
export class LiveReactions {
  readonly message = input.required<ChatMessage>();
  readonly compact = input(false);
  readonly own = input(false);
  readonly readonly = input(false);
  private readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  protected readonly action = new ChatAction();
  protected readonly expanded = signal(false);
  private readonly reactions = computed(() =>
    (this.store.reactions()[this.message().roomId] ?? []).filter(
      (item) => item.messageId === this.message().id,
    ),
  );
  protected readonly items = computed(() =>
    [...new Set(this.reactions().flatMap((item) => item.emojis))].map((emoji) =>
      this.summary(emoji),
    ),
  );

  /** Collects participant names and the current user's selection for one displayed emoji. */
  private summary(emoji: string) {
    const reactions = this.reactions().filter((item) => item.emojis.includes(emoji));
    return {
      emoji,
      names: reactions.map((item) => this.store.person(item.userId).name),
      mine: reactions.some((item) => item.userId === this.store.session.user()?.uid),
    };
  }

  /** Submits a per-user emoji toggle while exposing failures without modifying another user's reactions. */
  protected toggle(emoji: string): void {
    void this.action.run(() => this.store.react(this.message(), emoji));
  }

  /** Opens reaction details scoped to this message and conversation. */
  protected people(): void {
    this.overlay.open('reactions', {
      live: true,
      channelId: this.message().roomId,
      messageId: this.message().id,
    });
  }
}
