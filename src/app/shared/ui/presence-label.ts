import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PresenceState } from '../../core/presence/presence-state';

/** Displays the server-observed presence state, including an explicit unavailable state instead of a guessed status. */
@Component({
  selector: 'app-presence-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="dot" aria-hidden="true" [attr.data-presence]="state.status(uid())"></span
    >{{ state.label(uid()) }}`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 15px;
      color: #686868;
      font-size: 20px;
    }
    .dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid #686868;
    }
    .dot[data-presence='online'] {
      background: #92c83e;
      border-color: #92c83e;
    }
    .dot[data-presence='offline'] {
      background: #686868;
    }
  `,
})
export class PresenceLabel {
  readonly uid = input.required<string>();
  protected readonly state = inject(PresenceState);
}
