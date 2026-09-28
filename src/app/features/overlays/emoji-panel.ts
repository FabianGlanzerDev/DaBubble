import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OverlayState } from '../../core/ui/overlay-state';

export const emojiOptions = [
  { text: '😀', label: 'Lachen', asset: 'grinning-face' },
  { text: '✅', label: 'Haken', asset: 'check-mark' },
  { text: '👍', label: 'Daumen hoch', asset: 'thumbs-up' },
  { text: '👏', label: 'Applaus', asset: 'clapping-hands' },
  { text: '❤️', label: 'Herz', asset: 'heart' },
  { text: '😎', label: 'Sonnenbrille', asset: 'smiling-face-with-sunglasses' },
  { text: '🤔', label: 'Nachdenken', asset: 'thinking-face' },
] as const;

/** Displays the shared emoji palette and delegates effects to the caller-provided callback. */
@Component({
  selector: 'app-emoji-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="emoji-grid">
      @for (emoji of emojis; track emoji.text) {
        <button
          type="button"
          [attr.aria-label]="emoji.label"
          [disabled]="!overlay.current()?.onEmoji"
          (click)="choose(emoji.text)"
        >
          <img
            [src]="'assets/images/original/emoji-' + emoji.asset + '.svg'"
            width="36"
            height="36"
            alt=""
          />
        </button>
      }
    </div>
    <p class="overlay-note">
      {{
        overlay.current()?.onEmoji
          ? 'Emoji wird nur in deinen lokalen Entwurf eingefügt. Kein Versand.'
          : 'Reaktionsvorschau. Reaktionen können ohne Anmeldung und Datenbank nicht gespeichert werden.'
      }}
    </p>`,
  styles: `
    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 24px 0;
    }
    button {
      display: grid;
      place-items: center;
      min-width: 44px;
      min-height: 44px;
      background: transparent;
      border: 0;
      border-radius: 12px;
    }
    button:hover:not(:disabled) {
      background: var(--accent-soft);
    }
    img {
      transition: transform 200ms;
    }
    button:hover img {
      transform: scale(1.1);
    }
  `,
})
export class EmojiPanel {
  protected readonly overlay = inject(OverlayState);
  protected readonly emojis = emojiOptions;

  /** Delivers an emoji to the initiating preview action and closes the picker. */
  protected choose(emoji: string): void {
    this.overlay.current()?.onEmoji?.(emoji);
    this.overlay.close();
  }
}
