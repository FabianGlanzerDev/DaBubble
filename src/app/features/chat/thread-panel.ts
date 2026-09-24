import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { MessagePreview } from './message-preview';
import { MessageComposer } from './message-composer';
import { question, threadReplies } from './preview-messages';

@Component({
  selector: 'app-thread-panel',
  imports: [Icon, MessagePreview, MessageComposer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section [attr.aria-labelledby]="headingId()">
    <header>
      <h2 [id]="headingId()" data-thread-heading data-page-heading tabindex="-1">Thread</h2>
      <span># Entwicklerteam</span>
      @if (closable()) {
        <button
          class="icon-button"
          type="button"
          aria-label="Thread schließen"
          (click)="closeThread.emit()"
        >
          <app-icon name="close" />
        </button>
      }
    </header>
    <div class="messages" aria-label="Statische Thread-Beispiele aus Figma">
      <app-message-preview [message]="question" [compact]="true" />
      <div class="reply-count"><span>2 Antworten</span></div>
      @for (reply of replies; track reply.author) {
        <app-message-preview [message]="reply" [compact]="true" />
      }
    </div>
    <app-message-composer
      [fieldId]="headingId() + '-reply'"
      [reply]="true"
      placeholder="Antworten…"
    />
  </section>`,
  styleUrl: './thread-panel.scss',
})
export class ThreadPanel {
  readonly headingId = input.required<string>();
  readonly closable = input(false);
  readonly closeThread = output<void>();
  protected readonly question = question;
  protected readonly replies = threadReplies;
}
