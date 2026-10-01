import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { ChatAction } from '../../core/chat/chat-action';
import { decodeMessage } from '../../core/chat/message-mentions';

/** Represents plain text or a safely resolved directory/channel navigation target. */
interface MessagePart {
  text: string;
  uid?: string;
  path?: string[];
}

/** Renders UID-based mentions as direct-chat actions, keeping ambiguous legacy names as plain text. */
@Component({
  selector: 'app-live-message-text',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (part of parts(); track $index) {
      @if (part.uid; as uid) {
        <button
          type="button"
          [disabled]="action.busy()"
          (click)="direct(uid)"
          [textContent]="part.text"
        ></button>
      } @else if (part.path; as path) {
        <a [routerLink]="path" [textContent]="part.text"></a>
      } @else {
        <span [textContent]="part.text"></span>
      }
    }
    @if (action.error()) {
      <span class="action-error" role="alert">{{ action.error() }}</span>
    }`,
  styles: `
    :host {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    button,
    a {
      display: inline;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-decoration: underline;
    }
  `,
})
export class LiveMessageText {
  readonly text = input.required<string>();
  private readonly store = inject(ChatStore);
  private readonly nav = inject(ChatNavigation);
  protected readonly action = new ChatAction();
  protected readonly parts = computed(() => this.split());

  /** Separates explicit identity ranges before considering older name-only message formats. */
  private split(): MessagePart[] {
    const draft = decodeMessage(this.text()),
      parts: MessagePart[] = [];
    let offset = 0;
    for (const mention of draft.mentions) {
      parts.push(...this.legacy(draft.text.slice(offset, mention.start)));
      parts.push(this.identityPart(draft.text.slice(mention.start, mention.end), mention.uid));
      offset = mention.end;
    }
    return [...parts, ...this.legacy(draft.text.slice(offset))];
  }

  /** Leaves unavailable identities readable without creating a conversation with a missing directory entry. */
  private identityPart(text: string, uid: string): MessagePart {
    const known = this.store.people().some((person) => person.uid === uid);
    return { text, uid: known ? uid : undefined };
  }

  /** Resolves legacy tokens only when the directory supplies one unambiguous identity. */
  private legacy(text: string): MessagePart[] {
    const names = [
      ...this.store.people().map((p) => '@' + p.name),
      ...this.store.channels().map((r) => '#' + r.name),
    ];
    const pattern = names
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    return (pattern ? text.split(new RegExp('(' + pattern + ')', 'g')) : [text])
      .filter(Boolean)
      .map((part) => this.target(part));
  }

  /** Avoids guessing between identical display names or revealing unavailable conversation details. */
  private target(text: string): MessagePart {
    const people = this.store.people().filter((person) => '@' + person.name === text);
    const room = this.store.channels().find((channel) => '#' + channel.name === text);
    return {
      text,
      uid: people.length === 1 ? people[0]?.uid : undefined,
      path: room ? this.nav.path(room) : undefined,
    };
  }

  /** Reuses the selected UID's direct conversation without opening an intermediate profile. */
  protected direct(uid: string): void {
    void this.action.run(() => this.nav.direct(uid));
  }
}
