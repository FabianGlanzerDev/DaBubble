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

@Component({
  selector: 'app-live-message',
  imports: [DatePipe, AvatarImage, Icon, LiveReactions, LiveMessageText],
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
  protected readonly replies = computed(() =>
    (this.store.messages()[this.message().roomId] ?? []).filter(
      (item) => item.rootId === this.message().id,
    ),
  );
  protected readonly editing = signal(false);
  protected readonly removing = signal(false);
  protected readonly pinned = signal(false);
  protected readonly text = signal('');

  protected profile(): void {
    this.overlay.open('profile', { live: true, personId: this.message().authorId });
  }

  protected beginEdit(): void {
    this.text.set(this.message().text);
    this.editing.set(true);
    this.removing.set(false);
  }

  protected save(): void {
    void this.action.run(async () => {
      await this.store.edit(this.message(), this.text());
      this.editing.set(false);
    });
  }

  protected remove(): void {
    void this.action.run(async () => {
      await this.store.remove(this.message());
      this.removing.set(false);
    });
  }

  protected react(emoji: string): void {
    void this.action.run(() => this.store.react(this.message(), emoji));
  }

  protected emojis(): void {
    this.overlay.open('emoji', { live: true, onEmoji: (emoji) => this.react(emoji) });
  }
}
