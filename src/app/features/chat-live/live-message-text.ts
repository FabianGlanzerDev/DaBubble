import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatNavigation } from '../../core/chat/chat-navigation';
import { OverlayState } from '../../core/ui/overlay-state';

/** Turns recognized directory and channel mentions into navigation controls without interpreting arbitrary HTML. */
@Component({
  selector: 'app-live-message-text',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (part of parts(); track $index) {
    @if (person(part); as match) {
      <button type="button" (click)="overlay.open('profile', { live: true, personId: match.uid })">
        {{ part }}
      </button>
    } @else if (channel(part); as match) {
      <a [routerLink]="nav.path(match)">{{ part }}</a>
    } @else {
      {{ part }}
    }
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
  protected readonly nav = inject(ChatNavigation);
  protected readonly overlay = inject(OverlayState);
  protected readonly parts = computed(() => this.split());

  /** Separates recognized mention tokens from plain message text while discarding empty fragments. */
  private split(): string[] {
    const pattern = this.pattern();
    return pattern
      ? this.text()
          .split(new RegExp('(' + pattern + ')', 'g'))
          .filter(Boolean)
      : [this.text()];
  }

  /** Escapes known names for literal matching and prioritizes longer names to avoid partial mention matches. */
  private pattern(): string {
    const names = [
      ...this.store.people().map((p) => '@' + p.name),
      ...this.store.channels().map((r) => '#' + r.name),
    ];
    return names
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
  }

  /** Resolves an exact rendered person mention against the available directory. */
  protected person(text: string) {
    return this.store.people().find((person) => '@' + person.name === text);
  }

  /** Resolves an exact channel mention only among conversations available to the current account. */
  protected channel(text: string) {
    return this.store.channels().find((room) => '#' + room.name === text);
  }
}
