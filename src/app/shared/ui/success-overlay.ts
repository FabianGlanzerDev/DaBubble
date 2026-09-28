import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  input,
  viewChild,
} from '@angular/core';
import { ConfirmationKind, ConfirmationMessage } from './confirmation-message';

/** Shows an accessible timed confirmation after its caller has established that the operation succeeded. */
@Component({
  selector: 'app-success-overlay',
  imports: [ConfirmationMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="success-layer">
    <div #status role="status" tabindex="-1" (keydown.enter)="finish()" (keydown.escape)="finish()">
      <app-confirmation-message [kind]="kind()" />
      @if (description()) {
        <span class="sr-only">{{ description() }}</span>
      }
    </div>
  </div>`,
  styles: `
    .success-layer {
      position: fixed;
      z-index: 20;
      inset: 0;
      overflow: hidden;
      background: #ffffff66;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 40px;
    }
    [role='status'] {
      max-width: 100%;
      outline: none;
      animation: success-in 300ms ease-out both;
    }
    @keyframes success-in {
      from {
        transform: translateX(calc(100% + 40px));
      }
      to {
        transform: none;
      }
    }
    @media (max-width: 767px) {
      .success-layer {
        padding: 24px 16px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      [role='status'] {
        animation: none;
      }
    }
  `,
})
export class SuccessOverlay {
  readonly kind = input.required<ConfirmationKind>();
  readonly description = input('');
  readonly finished = output<void>();
  private readonly destroy = inject(DestroyRef);
  private readonly status = viewChild.required<ElementRef<HTMLElement>>('status');
  private done = false;

  /** Focuses the confirmation after rendering and disposes the automatic completion timer on destruction. */
  constructor() {
    afterNextRender(() => this.status().nativeElement.focus());
    const timer = setTimeout(() => this.finish(), 1800);
    this.destroy.onDestroy(() => clearTimeout(timer));
  }

  /** Emits completion at most once, whether triggered by the timer, Enter or Escape. */
  protected finish(): void {
    if (this.done) return;
    this.done = true;
    this.finished.emit();
  }
}
