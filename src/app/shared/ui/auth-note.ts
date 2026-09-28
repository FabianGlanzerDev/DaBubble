import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Groups explanatory content for explicitly marked preview pages rather than real authentication forms. */
@Component({
  selector: 'app-auth-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<details
    #note
    class="preview-note"
    tabindex="-1"
    (keydown.escape)="note.open = false; summary.focus()"
  >
    <summary #summary>Hinweise &amp; Vorschau</summary>
    <div class="note-content"><ng-content /></div>
  </details>`,
  styleUrl: './auth-note.scss',
})
export class AuthNote {}
