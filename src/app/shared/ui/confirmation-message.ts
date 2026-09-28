import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const messages = {
  account: 'Konto erfolgreich erstellt!',
  email: 'E-Mail gesendet',
  signin: 'Anmelden',
} as const;
export type ConfirmationKind = keyof typeof messages;

/** Shared presentation; callers are responsible for confirming successful persistence. */
@Component({
  selector: 'app-confirmation-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="confirmation">
    @if (kind() === 'email') {
      <svg class="send-icon" viewBox="60 58.5 40 40" aria-hidden="true" focusable="false">
        <path
          d="M64.2497 93.6086C63.5552 93.8864 62.8955 93.8253 62.2705 93.4253C61.6455 93.0267 61.333 92.4454 61.333 91.6815V83.9211C61.333 83.435 61.4719 83.001 61.7497 82.619C62.0275 82.2371 62.4094 81.994 62.8955 81.8899L77.9997 78.1399L62.8955 74.3899C62.4094 74.2857 62.0275 74.0426 61.7497 73.6607C61.4719 73.2788 61.333 72.8447 61.333 72.3586V64.5982C61.333 63.8343 61.6455 63.2524 62.2705 62.8524C62.8955 62.4538 63.5552 62.3933 64.2497 62.6711L96.333 76.2128C97.2011 76.5947 97.6351 77.2371 97.6351 78.1399C97.6351 79.0426 97.2011 79.685 96.333 80.0669L64.2497 93.6086Z"
          fill="currentColor"
        />
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
