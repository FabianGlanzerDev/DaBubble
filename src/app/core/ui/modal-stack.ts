import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { canFocus, cycleModalFocus, focusModal } from './modal-focus-targets';

/** One modal layer, its surviving trigger and the caller's current dismissal policy. */
interface ModalEntry {
  dialog: HTMLDialogElement;
  opener: HTMLElement | null;
  dismiss: () => void;
}

/** Coordinates native top-layer dialogs; only the topmost receives keyboard input or accessibility exposure. */
@Injectable({ providedIn: 'root' })
export class ModalStack {
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly entries: ModalEntry[] = [];
  private pointerTrigger: HTMLElement | null = null;

  /** Installs capture listeners so background shortcuts cannot react to a modal's Tab or Escape. */
  constructor() {
    this.listen('keydown', (event) => this.keydown(event));
    this.listen('focusin', () => this.containFocus());
    this.listen('pointerdown', (event) => this.rememberTrigger(event));
  }

  /** Releases document listeners with the application instead of retaining detached dialog services. */
  private listen<K extends keyof DocumentEventMap>(
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
  ): void {
    this.document.addEventListener(type, handler, true);
    this.destroy.onDestroy(() => this.document.removeEventListener(type, handler, true));
  }

  /** Captures touch and pointer triggers even in browsers that do not focus a clicked button. */
  private rememberTrigger(event: PointerEvent): void {
    this.pointerTrigger =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')
        : null;
  }

  /** Captures the trigger before showModal makes the page inert and activates the new dialog. */
  open(dialog: HTMLDialogElement, dismiss: () => void): void {
    if (this.entries.some((entry) => entry.dialog === dialog)) return;
    const opener = this.pointerTrigger?.isConnected
      ? this.pointerTrigger
      : (this.document.activeElement as HTMLElement | null);
    this.pointerTrigger = null;
    this.entries.push({ dialog, opener, dismiss });
    dialog.showModal();
    this.syncLayers();
    focusModal(dialog);
  }

  /** Restores the surviving trigger only after removing this dialog from the active stack. */
  close(dialog: HTMLDialogElement): void {
    const index = this.entries.findIndex((entry) => entry.dialog === dialog);
    if (index < 0) return;
    const wasTop = this.isTop(dialog);
    const entry = this.entries.splice(index, 1)[0]!;
    this.expose(dialog, false);
    this.syncLayers();
    dialog.close();
    if (wasTop && entry.opener && canFocus(entry.opener))
      entry.opener.focus({ preventScroll: true });
    this.containFocus();
  }

  /** Reports whether a modal owns keyboard focus, even while another dialog is closing underneath it. */
  isTop(dialog: HTMLDialogElement): boolean {
    return this.entries.at(-1)?.dialog === dialog;
  }

  /** Uses native modal inertness for the page and explicitly hides separate lower modal layers. */
  private syncLayers(): void {
    const top = this.entries.at(-1)?.dialog;
    for (const { dialog } of this.entries) {
      this.expose(dialog, dialog !== top && !dialog.contains(top ?? null));
      dialog.setAttribute('aria-modal', String(dialog === top));
    }
  }

  /** Never hides an ancestor of a nested native dialog, which would hide the active dialog as well. */
  private expose(dialog: HTMLDialogElement, hidden: boolean): void {
    dialog.inert = hidden;
    if (hidden) dialog.setAttribute('aria-hidden', 'true');
    else dialog.removeAttribute('aria-hidden');
  }

  /** Traps Tab and delegates Escape only to the current dialog's explicit dismissal policy. */
  private keydown(event: KeyboardEvent): void {
    this.pointerTrigger = null;
    const entry = this.entries.at(-1);
    if (!entry || (event.key !== 'Tab' && event.key !== 'Escape')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === 'Tab') cycleModalFocus(entry.dialog, event.shiftKey);
    else entry.dismiss();
  }

  /** Repairs focus after a focused control is removed or disabled without stealing valid in-dialog focus. */
  containFocus(): void {
    const dialog = this.entries.at(-1)?.dialog;
    const active = this.document.activeElement;
    if (!dialog || (active instanceof HTMLElement && dialog.contains(active) && canFocus(active)))
      return;
    focusModal(dialog);
  }
}
