import { Injectable, signal } from '@angular/core';

/** Only a display name in memory. No credentials or account persistence. */
@Injectable({ providedIn: 'root' })
export class RegistrationPreview {
  readonly name = signal('Frederik Beck');
}
