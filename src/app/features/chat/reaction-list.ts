import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, map, startWith } from 'rxjs';
import { OverlayState } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';

/** Presents example reaction counts and participant details without persisting user selections. */
@Component({
  selector: 'app-reaction-list',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="reactions" aria-label="Beispielreaktionen">
    @for (reaction of visible(); track $index) {
      <button
        class="reaction"
        (click)="overlay.open('reactions')"
        [attr.aria-label]="reaction + ' – Beispielreaktion ansehen'"
      >
        @if (emojiAssets[reaction]; as asset) {
          <img
            [src]="'assets/images/original/figma-reaction-' + asset + '.svg'"
            width="24"
            height="24"
            alt=""
          />
        } @else {
          <span class="placeholder-emoji">{{ reaction }}</span>
        }
        <small>1</small
        ><span class="tip" role="tooltip"
          >{{ reaction }}<strong>Frederik Beck</strong><span>hat reagiert · Beispiel</span></span
        >
      </button>
    }
    @if (hiddenCount() || expanded()) {
      <button class="more" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
        {{ expanded() ? 'Weniger anzeigen' : hiddenCount() + ' weitere' }}
      </button>
    }
    <button
      class="icon-button"
      aria-label="Reaktionsauswahl ansehen"
      (click)="overlay.open('emoji')"
    >
      <app-icon name="reaction" />
    </button>
  </div>`,
  styleUrl: './reaction-list.scss',
})
export class ReactionList {
  protected readonly emojiAssets: Readonly<Record<string, string>> = {
    '🚀': 'rocket',
    '✅': 'check',
    '🤓': 'nerd',
    '👍': 'thumb',
  };
  readonly reactions = input.required<readonly string[]>();
  readonly compact = input(false);
  protected readonly overlay = inject(OverlayState);
  protected readonly expanded = signal(false);
  private readonly mobile = toSignal(
    fromEvent(window, 'resize').pipe(
      map(() => window.innerWidth < 768),
      startWith(window.innerWidth < 768),
    ),
  );
  protected readonly limit = computed(() => (this.compact() || this.mobile() ? 7 : 20));
  private readonly allowedReactions = computed(() => this.reactions().slice(0, 20));
  protected readonly visible = computed(() =>
    this.expanded() ? this.allowedReactions() : this.allowedReactions().slice(0, this.limit()),
  );
  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.allowedReactions().length - this.limit()),
  );
}
