import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalFocus } from './modal-focus';

let sequence = 0;

/** Keeps destructive confirmation separate from its parent dialog and initially focuses the safe action. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog
    [appModalFocus]="true"
    [modalDismissible]="!busy()"
    (modalDismiss)="cancelled.emit()"
    [attr.aria-labelledby]="titleId"
    [attr.aria-describedby]="messageId"
    [attr.aria-busy]="busy()"
  >
    <h2 [id]="titleId" tabindex="-1" data-modal-heading>{{ heading() }}</h2>
    <p [id]="messageId">{{ message() }}</p>
    @if (error()) {
      <p class="action-error" role="alert">{{ error() }}</p>
    }
    <div class="actions">
      <button
        class="button secondary"
        type="button"
        data-modal-focus
        [disabled]="busy()"
        (click)="cancelled.emit()"
      >
        Abbrechen
      </button>
      <button class="button" type="button" [disabled]="busy()" (click)="confirmed.emit()">
        {{ busy() ? 'Wird ausgeführt…' : confirmLabel() }}
      </button>
    </div>
  </dialog>`,
  styles: `
    dialog {
      width: 500px;
      max-width: calc(100vw - 32px);
      max-height: calc(100dvh - 32px);
      padding: 32px;
      border: 0;
      border-radius: 30px;
      background: white;
      color: var(--text);
      box-shadow: 0 6px 10px #0003;
      overflow-y: auto;
    }
    dialog::backdrop {
      background: #0005;
    }
    h2 {
      margin-top: 0;
      font-size: 24px;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 24px;
    }
    @media (max-width: 374px) {
      dialog {
        padding: 24px 16px;
      }
    }
  `,
})
export class ConfirmDialog {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly busy = input(false);
  readonly error = input('');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  protected readonly titleId = `confirmation-title-${++sequence}`;
  protected readonly messageId = `${this.titleId}-message`;
}
