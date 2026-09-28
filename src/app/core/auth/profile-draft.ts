import { Injectable, signal } from '@angular/core';

/** Keeps only unsaved name/avatar choices while switching between profile dialogs. */
@Injectable({ providedIn: 'root' })
export class ProfileDraftState {
  readonly name = signal('Frederik Beck');
  readonly avatar = signal(2);

  /** Seeds the unsaved profile editor from the selected account's displayed values. */
  begin(name: string, avatar: number): void {
    this.name.set(name);
    this.avatar.set(avatar);
  }
}
