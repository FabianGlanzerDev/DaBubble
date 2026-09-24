import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { OverlayState } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-live-composer',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form
    class="composer"
    (submit)="$event.preventDefault(); send()"
    [attr.aria-busy]="action.busy()"
  >
    <label class="sr-only" [for]="fieldId()">{{
      rootId() ? 'Antwort schreiben' : 'Nachricht schreiben'
    }}</label>
    <textarea
      #field
      [id]="fieldId()"
      rows="2"
      maxlength="4000"
      [placeholder]="rootId() ? 'Antworten…' : 'Nachricht schreiben…'"
      [value]="draft()"
      (input)="update($event)"
      (keydown)="key($event)"
      [disabled]="action.busy()"
    ></textarea>
    @if (suggestions().length) {
      <div class="mentions" aria-label="Erwähnungen">
        @for (entry of suggestions(); track entry) {
          <button type="button" (click)="mention(entry)">{{ entry }}</button>
        }
      </div>
    }
    <div class="tools">
      <button
        class="icon-button"
        type="button"
        aria-label="Emoji einfügen"
        (click)="emoji()"
        [disabled]="action.busy()"
      >
        <app-icon name="smile" />
      </button>
      <button
        class="icon-button"
        type="button"
        aria-label="Person erwähnen"
        (click)="insert('@')"
        [disabled]="action.busy()"
      >
        <app-icon name="at" />
      </button>
      <span class="draft-note">{{
        action.busy() ? 'Wird gesendet…' : 'Enter: senden · Shift+Enter: neue Zeile'
      }}</span>
      <button
        class="icon-button send"
        type="submit"
        [disabled]="!draft().trim() || action.busy()"
        aria-label="Nachricht senden"
      >
        <app-icon name="send" />
      </button>
    </div>
    @if (action.error()) {
      <p class="action-error" role="alert">{{ action.error() }}</p>
    }
  </form>`,
  styleUrl: '../chat/message-composer.scss',
})
export class LiveComposer {
  readonly roomId = input.required<string>();
  readonly rootId = input('');
  readonly fieldId = input('chat-message');
  private readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');
  protected readonly action = new ChatAction();
  protected readonly draft = signal('');
  private readonly cursor = signal(0);
  private readonly token = computed(
    () =>
      this.draft()
        .slice(0, this.cursor())
        .match(/(?:^|\s)([@#][^\s]*)$/)?.[1] ?? '',
  );
  protected readonly suggestions = computed(() =>
    this.token()
      ? this.entries().filter((entry) =>
          entry.toLocaleLowerCase().startsWith(this.token().toLocaleLowerCase()),
        )
      : [],
  );

  constructor() {
    afterNextRender(() => this.field().nativeElement.focus({ preventScroll: true }));
  }

  private entries(): string[] {
    return [
      ...this.store.people().map((person) => '@' + person.name),
      ...this.store.channels().map((room) => '#' + room.name),
    ];
  }

  protected update(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    this.draft.set(field.value);
    this.cursor.set(field.selectionStart);
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cursor.set(0);
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.send();
  }

  protected send(): void {
    if (!this.draft().trim()) return;
    void this.action.run(async () => {
      await this.store.send(this.roomId(), this.draft(), this.rootId());
      this.draft.set('');
      this.cursor.set(0);
      requestAnimationFrame(() => this.field().nativeElement.focus({ preventScroll: true }));
    });
  }

  protected insert(text: string): void {
    const field = this.field().nativeElement;
    const start = field.selectionStart;
    this.draft.set(this.draft().slice(0, start) + text + this.draft().slice(field.selectionEnd));
    this.cursor.set(start + text.length);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + text.length, start + text.length);
    });
  }

  protected mention(text: string): void {
    const field = this.field().nativeElement;
    field.setSelectionRange(this.cursor() - this.token().length, this.cursor());
    this.insert(text + ' ');
  }

  protected emoji(): void {
    this.overlay.open('emoji', { live: true, onEmoji: (emoji) => this.insert(emoji) });
  }
}
