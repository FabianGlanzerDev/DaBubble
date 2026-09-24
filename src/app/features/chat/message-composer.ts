import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { OverlayState } from '../../core/ui/overlay-state';
import { channels, directMessages } from './workspace-items';
import { AvatarImage } from '../../shared/ui/avatar-image';

@Component({
  selector: 'app-message-composer',
  imports: [Icon, AvatarImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-composer.html',
  styleUrl: './message-composer.scss',
})
export class MessageComposer {
  readonly fieldId = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly reply = input(false);
  private readonly overlay = inject(OverlayState);
  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('field');
  protected readonly draft = signal('');
  protected readonly mentionsOpen = signal(false);
  protected readonly mentionQuery = signal('');
  protected readonly mentions = [
    ...channels.map((item) => '#' + item.label),
    ...directMessages.map((item) => '@' + item.label),
  ];
  protected readonly filteredMentions = computed(() =>
    this.mentions.filter((mention) =>
      mention.toLocaleLowerCase().startsWith(this.mentionQuery().toLocaleLowerCase()),
    ),
  );

  protected updateDraft(value: string): void {
    this.draft.set(value);
    this.mentionQuery.set(value.match(/(?:^|\s)([@#][\p{L}\p{N}-]*)$/u)?.[1] ?? '');
    this.mentionsOpen.set(!!this.mentionQuery());
  }

  protected openEmoji(): void {
    this.overlay.open('emoji', { onEmoji: (emoji) => this.insert(emoji) });
  }

  protected mentionAvatar(mention: string): number | null {
    return directMessages.find((person) => '@' + person.label === mention)?.avatar ?? null;
  }

  protected insert(text: string): void {
    const value = this.mentionQuery()
      ? this.draft().slice(0, -this.mentionQuery().length)
      : this.draft();
    this.draft.set(value + (value && !value.endsWith(' ') ? ' ' : '') + text + ' ');
    this.mentionQuery.set('');
    this.mentionsOpen.set(false);
    this.field()?.nativeElement.focus();
  }
}
