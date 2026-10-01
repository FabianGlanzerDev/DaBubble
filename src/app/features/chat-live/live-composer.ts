import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { OverlayState } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { ChatDrafts } from '../../core/chat/chat-drafts';
import { changeDraft, encodeMessage } from '../../core/chat/message-mentions';
import type { ChatPerson } from '../../core/chat/chat-models';

/** A selectable mention with a stable identity separate from its visible name and inserted text. */
interface MentionOption {
  key: string;
  value: string;
  label: string;
  person?: ChatPerson;
}

/** Sends real messages or thread replies and inserts emoji or accessible-directory mentions at the caret. */
@Component({
  selector: 'app-live-composer',
  imports: [Icon, AvatarImage],
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
      [placeholder]="placeholder()"
      [value]="draft()"
      (input)="update($event)"
      (keydown)="key($event)"
      (click)="caret()"
      (keyup.arrowleft)="caret()"
      (keyup.arrowright)="caret()"
      [attr.aria-expanded]="suggestions().length > 0"
      [attr.aria-controls]="fieldId() + '-mentions'"
      [disabled]="action.busy()"
    ></textarea>
    @if (suggestions().length) {
      <div
        class="mentions"
        [id]="fieldId() + '-mentions'"
        (keydown.arrowdown)="moveSuggestion($event, 1)"
        (keydown.arrowup)="moveSuggestion($event, -1)"
        role="group"
        aria-label="Erwähnungen"
        (keydown.escape)="dismissMentions($event)"
      >
        @for (entry of suggestions(); track entry.key) {
          <button
            #option
            type="button"
            [attr.aria-label]="entry.value"
            [attr.data-mention-id]="entry.key"
            (click)="mention(entry)"
          >
            @if (entry.person; as person) {
              <app-avatar-image [index]="person.avatarId" [uid]="person.uid" [size]="50" />
            }
            <span>{{ entry.label }}</span>
          </button>
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
        (click)="startMention()"
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
  readonly placeholder = input('Nachricht schreiben…');
  private readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');
  private readonly destroy = inject(DestroyRef);
  protected readonly action = new ChatAction();
  private readonly drafts = inject(ChatDrafts);
  private readonly draftKey = computed(() => this.roomId() + '/' + this.rootId());
  private readonly content = computed(() => this.drafts.get(this.draftKey()));
  protected readonly draft = computed(() => this.content().text);
  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');
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
          entry.value.toLocaleLowerCase().startsWith(this.token().toLocaleLowerCase()),
        )
      : [],
  );

  /** Focuses the newly rendered editor without shifting the conversation's scroll position. */
  constructor() {
    afterNextRender(() => this.field().nativeElement.focus({ preventScroll: true }));
  }

  /** Builds mention suggestions from directory people and channels already available to this account. */
  private entries(): MentionOption[] {
    return [
      ...this.store.people().map((person) => this.personMention(person)),
      ...this.store.channels().map((room) => ({
        key: 'channel/' + room.id,
        value: '#' + room.name,
        label: '#' + room.name,
      })),
    ];
  }

  /** Marks the current account while keeping equal display names distinct during list updates. */
  private personMention(person: ChatPerson): MentionOption {
    return {
      key: 'person/' + person.uid,
      value: '@' + person.name,
      label: person.name + (person.uid === this.store.session.user()?.uid ? ' (Du)' : ''),
      person,
    };
  }

  /** Dismisses this nonmodal suggestion list and returns keyboard users to their unchanged draft. */
  protected dismissMentions(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cursor.set(0);
    this.field().nativeElement.focus();
  }

  /** Keeps the draft and caret position synchronized for contextual mention suggestions. */
  protected update(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    this.replaceDraft(field.value);
    this.cursor.set(field.selectionStart);
  }

  /** Reads a moved caret so mention filtering follows mouse and keyboard selection. */
  protected caret(): void {
    this.cursor.set(this.field().nativeElement.selectionStart);
  }

  /** Starts a new mention token at the saved editor selection, even after ordinary text. */
  protected startMention(): void {
    const start = this.field().nativeElement.selectionStart;
    this.insert(start && !/\s/.test(this.draft().charAt(start - 1)) ? ' @' : '@');
  }

  /** Moves through suggestions with arrow keys while retaining normal Tab navigation. */
  protected moveSuggestion(event: Event, direction: number): void {
    event.preventDefault();
    const options = this.options().map((option) => option.nativeElement);
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    options[(current + direction + options.length) % options.length]?.focus();
  }

  /** Opens keyboard suggestions before considering Enter as a send action, preserving IME composition. */
  protected key(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Escape') this.dismissMentions(event);
    if (event.key === 'ArrowDown' && this.suggestions().length) {
      event.preventDefault();
      this.options()[0]?.nativeElement.focus();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  /** Updates visible text while retaining identities only for mention ranges that were not edited. */
  private replaceDraft(text: string): void {
    this.drafts.set(this.draftKey(), changeDraft(this.content(), text));
  }

  /** Clears only the successfully sent room/thread draft, even if navigation changes during the write. */
  protected send(): void {
    if (!this.draft().trim()) return;
    const key = this.draftKey(),
      text = encodeMessage(this.content());
    void this.action.run(async () => {
      await this.store.send(this.roomId(), text, this.rootId());
      this.drafts.set(key, { text: '', mentions: [] });
      this.cursor.set(0);
      requestAnimationFrame(() => {
        if (!this.destroy.destroyed) this.field().nativeElement.focus({ preventScroll: true });
      });
    });
  }

  /** Replaces the current text selection and restores the caret immediately after the inserted content. */
  protected insert(text: string): void {
    const field = this.field().nativeElement;
    const start = field.selectionStart;
    this.replaceDraft(this.draft().slice(0, start) + text + this.draft().slice(field.selectionEnd));
    this.cursor.set(start + text.length);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + text.length, start + text.length);
    });
  }

  /** Inserts the selected visible name and retains its UID independently of duplicate or later renamed accounts. */
  protected mention(entry: MentionOption): void {
    const start = this.cursor() - this.token().length;
    this.field().nativeElement.setSelectionRange(start, this.cursor());
    this.insert(entry.value + ' ');
    if (!entry.person) return;
    const draft = this.content();
    const mention = { start, end: start + entry.value.length, uid: entry.person.uid };
    this.drafts.set(this.draftKey(), {
      ...draft,
      mentions: [...draft.mentions, mention].sort((a, b) => a.start - b.start),
    });
  }

  /** Opens the shared picker with a callback that inserts the chosen emoji into this draft. */
  protected emoji(): void {
    this.overlay.open('emoji', { live: true, onEmoji: (emoji) => this.insert(emoji) });
  }
}
