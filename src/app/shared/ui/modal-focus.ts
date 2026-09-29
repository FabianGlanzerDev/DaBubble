import {
  afterRenderEffect,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { ModalStack } from '../../core/ui/modal-stack';
import { focusModal } from '../../core/ui/modal-focus-targets';

/** Gives native dialogs reusable focus containment, transition focus and safe trigger restoration. */
@Directive({
  selector: 'dialog[appModalFocus]',
  host: { tabindex: '-1', '(cancel)': 'cancel($event)' },
})
export class ModalFocus {
  readonly appModalFocus = input<unknown>(true);
  readonly modalDismissible = input(false);
  readonly modalDismiss = output<void>();
  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;
  private readonly stack = inject(ModalStack);
  private context: unknown;

  /** Tracks rendered dialog transitions and repairs focus when async content removes the focused node. */
  constructor() {
    const observer = new MutationObserver(() => this.stack.containFocus());
    observer.observe(this.dialog, { childList: true, subtree: true, attributes: true });
    afterRenderEffect(() => this.sync());
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      this.stack.close(this.dialog);
    });
  }

  /** Opens or closes the native modal and refocuses meaningful content when its view changes. */
  private sync(): void {
    const context = this.appModalFocus();
    if (context) {
      this.stack.open(this.dialog, () => this.dismiss());
      if (context !== this.context && this.stack.isTop(this.dialog)) focusModal(this.dialog);
    } else this.stack.close(this.dialog);
    this.context = context;
  }

  /** Prevents implicit native dismissal so the caller retains its animation and pending-action policy. */
  protected cancel(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismiss();
  }

  /** Emits only when the caller opted into dismissal and this dialog is the active top layer. */
  private dismiss(): void {
    if (this.modalDismissible() && this.stack.isTop(this.dialog)) this.modalDismiss.emit();
  }
}
