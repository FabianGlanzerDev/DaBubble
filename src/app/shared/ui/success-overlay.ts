import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  output,
  input,
} from '@angular/core';
import { ConfirmationKind, ConfirmationMessage } from './confirmation-message';
import { ModalFocus } from './modal-focus';

/** Shows an accessible timed confirmation after its caller has established that the operation succeeded. */
@Component({
  selector: 'app-success-overlay',
  imports: [ConfirmationMessage, ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog
    class="success-layer"
    [appModalFocus]="true"
    tabindex="-1"
    [modalDismissible]="true"
    (modalDismiss)="finish()"
    aria-labelledby="success-message"
    (keydown.enter)="finish()"
  >
    <div id="success-message" role="status" tabindex="-1" data-modal-focus>
      <app-confirmation-message [kind]="kind()" />
      @if (description()) {
        <span class="sr-only">{{ description() }}</span>
      }
    </div>
  </dialog>`,
  styles: `
    .success-layer {
      position: fixed;
      z-index: 20;
      inset: 0;
      width: 100%;
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      border: 0;
      overflow: hidden;
      background: transparent;
      color: inherit;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 40px;
    }
    .success-layer[open] {
      display: flex;
    }
    .success-layer::backdrop {
      background: #ffffff66;
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
  private done = false;

  /** Disposes the automatic completion timer if navigation destroys the confirmation early. */
  constructor() {
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
