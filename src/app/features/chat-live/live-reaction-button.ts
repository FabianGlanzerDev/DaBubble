import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Displays an accessible reaction toggle with a viewport-contained, nonmodal Figma tooltip. */
@Component({
  selector: 'app-live-reaction-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
      #trigger
      type="button"
      [attr.aria-pressed]="mine()"
      [disabled]="disabled()"
      [attr.aria-label]="emoji() + ': ' + names().join(', ')"
      (click)="selected.emit()"
      (mouseenter)="show()"
      (focus)="show()"
      (blur)="hide()"
      (keydown.escape)="hide()"
    >
      <span class="emoji">{{ emoji() }}</span
      ><span>{{ names().length }}</span>
    </button>
    <div #tip popover="manual" class="tip" role="tooltip">
      <span class="emoji">{{ emoji() }}</span
      ><strong>{{ names().join(', ') }}</strong>
      <span>{{ names().length === 1 ? 'hat reagiert' : 'haben reagiert' }}</span>
    </div>`,
  host: {
    '(mouseleave)': 'hide()',
    '(window:resize)': 'hide()',
    '(document:keydown.escape)': 'hide()',
  },
  styleUrl: './live-reaction-button.scss',
})
export class LiveReactionButton {
  readonly emoji = input.required<string>();
  readonly names = input.required<string[]>();
  readonly mine = input(false);
  readonly disabled = input(false);
  readonly selected = output<void>();
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly tip = viewChild.required<ElementRef<HTMLElement>>('tip');

  /** Uses the top layer to prevent transcript clipping while keeping the tooltip within the viewport. */
  protected show(): void {
    const tip = this.tip().nativeElement;
    tip.showPopover();
    const button = this.trigger().nativeElement.getBoundingClientRect();
    const left = Math.max(8, Math.min(button.left, window.innerWidth - tip.offsetWidth - 8));
    const top =
      button.top >= tip.offsetHeight + 12 ? button.top - tip.offsetHeight - 8 : button.bottom + 8;
    tip.style.left = left + 'px';
    tip.style.top = Math.max(8, Math.min(top, window.innerHeight - tip.offsetHeight - 8)) + 'px';
  }

  /** Dismisses supplementary details without changing the persisted reaction or keyboard focus. */
  protected hide(): void {
    this.tip().nativeElement.hidePopover();
  }
}
