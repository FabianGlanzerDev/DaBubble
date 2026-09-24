import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const messages = {
  account: 'Konto erfolgreich erstellt!',
  email: 'E-Mail gesendet',
  signin: 'Anmelden',
} as const;
export type ConfirmationKind = keyof typeof messages;

/** Visual component only. A real success event must be supplied by a future caller. */
@Component({
  selector: 'app-confirmation-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="confirmation">
    @if (kind() === 'email') {
      <svg class="send-icon" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <path d="M3 3 37 18.5a1.6 1.6 0 0 1 0 3L3 37V24l23-4L3 16Z" fill="currentColor" />
      </svg>
    }
    <span>{{ messages[kind()] }}</span>
  </div>`,
  styleUrl: './confirmation-message.scss',
})
export class ConfirmationMessage {
  readonly kind = input.required<ConfirmationKind>();
  protected readonly messages = messages;
}
