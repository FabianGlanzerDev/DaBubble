import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { Icon } from './icon';

export type FieldKind = 'name' | 'email' | 'password' | 'confirmation';

export function fieldError(kind: FieldKind, value: string, match = ''): string {
  if (!value.trim())
    return kind === 'name'
      ? 'Bitte gib deinen Namen ein.'
      : kind === 'email'
        ? 'Bitte gib deine E-Mail-Adresse ein.'
        : 'Bitte gib ein Passwort ein.';
  if (kind === 'name' || kind === 'email') return identityFieldError(kind, value);
  if (kind === 'password' && value.length < 6)
    return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
  if (kind === 'confirmation' && value !== match) return 'Die Passwörter stimmen nicht überein.';
  return '';
}

function identityFieldError(kind: 'name' | 'email', value: string): string {
  if (kind === 'name' && value.trim().length > 80)
    return 'Der Name darf höchstens 80 Zeichen lang sein.';
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return 'Bitte gib eine gültige E-Mail-Adresse ein.';
  return '';
}

@Component({
  selector: 'app-form-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="field-wrap">
    <label [class.invalid]="showError()"
      ><span class="sr-only">{{ label() }}</span>
      @if (icon(); as glyph) {
        <app-icon [name]="glyph" />
      }
      <input
        #field
        [type]="
          kind() === 'password' || kind() === 'confirmation'
            ? 'password'
            : kind() === 'email'
              ? 'email'
              : 'text'
        "
        [value]="value()"
        [id]="fieldId()"
        [disabled]="disabled()"
        (input)="value.set(field.value)"
        (blur)="touched.set(true)"
        [placeholder]="placeholder()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="showError()"
        [attr.aria-describedby]="showError() ? fieldId() + '-error' : null"
    /></label>
    @if (showError()) {
      <span class="error" [id]="fieldId() + '-error'" aria-live="polite">{{ error() }}</span>
    }
  </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .field-wrap {
      position: relative;
    }
    label {
      display: flex;
      align-items: center;
      gap: 30px;
      min-height: 60px;
      padding: 0 32px;
      border: 1px solid transparent;
      border-radius: 100px;
      background: var(--page);
      color: var(--text-secondary);
      transition: border-color 200ms;
    }
    label:hover {
      border-color: var(--text-secondary);
    }
    label:focus-within {
      border-color: var(--accent);
    }
    label.invalid {
      border-color: #bd2626;
    }
    input {
      width: 100%;
      min-width: 0;
      padding: 16px 0;
      border: 0;
      background: transparent;
      font-size: 18px;
      line-height: 26px;
      color: var(--text);
    }
    input::placeholder {
      color: #686868;
      opacity: 1;
    }
    input:focus-visible {
      outline: none;
    }
    label:has(input:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }
    .error {
      display: block;
      margin: 4px 12px 0;
      color: #a51e1e;
      font-size: 12px;
      line-height: 15px;
    }
    @media (max-width: 767px) {
      label {
        min-height: var(--mobile-field-height, 50px);
        gap: 28px;
        padding: 0 30px;
      }
      input {
        font-size: 18px;
        line-height: 24px;
        padding: 12px 0;
      }
      .error {
        margin-inline: 0;
        font-size: 11px;
      }
    }
    @media (max-width: 374px) {
      label {
        padding-inline: 16px;
        gap: 14px;
      }
      input {
        font-size: 16px;
      }
    }
  `,
})
export class FormField {
  readonly kind = input.required<FieldKind>();
  readonly label = input.required<string>();
  readonly fieldId = input.required<string>();
  readonly placeholder = input('');
  readonly autocomplete = input('off');
  readonly icon = input<'user' | 'mail' | 'lock' | null>(null);
  readonly match = input('');
  readonly disabled = input(false);
  readonly submitted = input(false);
  readonly serverError = input('');
  readonly value = model('');
  protected readonly touched = signal(false);
  protected readonly error = computed(
    () => this.serverError() || fieldError(this.kind(), this.value(), this.match()),
  );
  protected readonly showError = computed(
    () => !!this.error() && (this.touched() || this.submitted() || !!this.serverError()),
  );
}
