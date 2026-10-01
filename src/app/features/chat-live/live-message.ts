import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { ChatMessage } from '../../core/chat/chat-models';
import { OverlayState } from '../../core/ui/overlay-state';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { LiveReactions } from './live-reactions';
import { LiveMessageText } from './live-message-text';
import {
  changeDraft,
  decodeMessage,
  encodeMessage,
  MessageDraft,
} from '../../core/chat/message-mentions';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';

/** Displays persisted message content with author actions, thread entry and real emoji reactions. */
@Component({
  selector: 'app-live-message',
  imports: [DatePipe, AvatarImage, Icon, LiveReactions, LiveMessageText, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-message.html',
  styleUrls: ['../chat/message-preview.scss', './live-message.scss'],
  host: { '[class.compact]': 'compact()' },
})
export class LiveMessage {
  readonly message = input.required<ChatMessage>();
  readonly compact = input(false);
  protected readonly store = inject(ChatStore);
  protected readonly nav = inject(ChatNavigation);
  private readonly overlay = inject(OverlayState);
  protected readonly action = new ChatAction();
  protected readonly author = computed(() => this.store.person(this.message().authorId));
  protected readonly own = computed(
    () => this.message().authorId === this.store.session.user()?.uid,
  );
  protected readonly archived = computed(
    () => this.store.rooms().find((room) => room.id === this.message().roomId)?.archived === true,
  );
  protected readonly replies = computed(() =>
    (this.store.messages()[this.message().roomId] ?? []).filter(
      (item) => item.rootId === this.message().id,
    ),
  );
  protected readonly editing = signal(false);
  protected readonly removing = signal(false);
  protected readonly pinned = signal(false);
  private readonly draft = signal<MessageDraft>({ text: '', mentions: [] });
  protected readonly text = computed(() => this.draft().text);
  protected readonly editorId = computed(
    () => 'edit-' + (this.compact() ? 'thread-' : 'main-') + this.message().id,
  );

  /** Opens the message author's real directory profile without requesting private profile fields. */
  protected profile(): void {
    this.overlay.open('profile', { live: true, personId: this.message().authorId });
  }

  /** Starts editing from the latest displayed text and dismisses pending deletion confirmation. */
  protected beginEdit(): void {
    this.draft.set(decodeMessage(this.message().text));
    this.editing.set(true);
    this.removing.set(false);
  }

  /** Preserves selected mention identities when editing surrounding text and drops modified labels. */
  protected updateText(event: Event): void {
    this.draft.set(changeDraft(this.draft(), (event.target as HTMLTextAreaElement).value));
  }

  /** Leaves edit mode only after the server accepts the message update. */
  protected save(): void {
    void this.action.run(async () => {
      await this.store.edit(this.message(), encodeMessage(this.draft()));
      this.editing.set(false);
    });
  }

  /** Applies the message tombstone and clears deletion confirmation only after the write succeeds. */
  protected remove(): void {
    void this.action.run(async () => {
      await this.store.remove(this.message());
      this.removing.set(false);
    });
  }

  /** Toggles a reaction through the shared pending/error wrapper to prevent duplicate action submissions. */
  protected react(emoji: string): void {
    void this.action.run(() => this.store.react(this.message(), emoji));
  }

  /** Connects the emoji picker to this message's persisted reaction action. */
  protected emojis(): void {
    this.overlay.open('emoji', { live: true, onEmoji: (emoji) => this.react(emoji) });
  }
}
