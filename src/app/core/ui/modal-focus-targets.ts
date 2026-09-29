const controls =
  'a[href], area[href], button, input, select, textarea, summary, [tabindex], ' +
  '[contenteditable="true"], audio[controls], video[controls]';

/** Excludes hidden, disabled and explicitly inert controls from modal focus destinations. */
export function canFocus(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    !element.matches(':disabled') &&
    !element.closest('[inert], [aria-hidden="true"]') &&
    element.checkVisibility({ visibilityProperty: true })
  );
}

/** Keeps the selected radio, or the first enabled radio in an unselected group, in the tab order. */
function radioStop(element: HTMLElement, candidates: HTMLElement[]): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name)
    return true;
  const group = candidates.filter(
    (candidate): candidate is HTMLInputElement =>
      candidate instanceof HTMLInputElement &&
      candidate.type === 'radio' &&
      candidate.name === element.name &&
      candidate.form === element.form,
  );
  return element === (group.find((radio) => radio.checked) ?? group[0]);
}

/** Recomputes browser-like tab stops so dynamic fields, radio groups and disabled actions stay correct. */
export function modalTabStops(dialog: HTMLDialogElement): HTMLElement[] {
  const candidates = [...dialog.querySelectorAll<HTMLElement>(controls)].filter(
    (element) => element.tabIndex >= 0 && canFocus(element),
  );
  return candidates
    .filter((element) => radioStop(element, candidates))
    .sort((left, right) => (left.tabIndex || Infinity) - (right.tabIndex || Infinity));
}

/** Prefers a meaningful field or heading; empty dialogs remain focusable as a final fallback. */
export function focusModal(dialog: HTMLDialogElement): void {
  const marked = [...dialog.querySelectorAll<HTMLElement>('[data-modal-focus]')].find(canFocus);
  const heading = dialog.querySelector<HTMLElement>('[data-modal-heading]');
  const target = marked ?? (heading && canFocus(heading) ? heading : modalTabStops(dialog)[0]);
  (target ?? dialog).focus({ preventScroll: true });
}

/** Wraps both tab directions, including dialogs with no enabled controls or a focused heading. */
export function cycleModalFocus(dialog: HTMLDialogElement, backwards: boolean): void {
  const stops = modalTabStops(dialog);
  const active = dialog.ownerDocument.activeElement as HTMLElement;
  const index = stops.indexOf(active);
  const next = backwards ? (index <= 0 ? stops.length - 1 : index - 1) : (index + 1) % stops.length;
  if (stops[next]) stops[next].focus();
  else focusModal(dialog);
}
