import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { OverlayState } from '../../core/ui/overlay-state';
import { examplePeople } from './workspace-people';
import { ReactionList } from './reaction-list';
import { AuthSession } from '../../core/auth/auth-session';

export interface PreviewMessage {
  readonly author: string;
  readonly avatar: number;
  readonly time: string;
  readonly text: string;
  readonly own?: boolean;
  readonly reactions?: readonly string[];
  readonly replies?: boolean;
}

@Component({
  selector: 'app-message-preview',
  imports: [AvatarImage, Icon, ReactionList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.compact]': 'compact()',
    '(document:click)': 'closeOutside($event)',
    '(document:keydown.escape)': 'closeActions()',
  },
  templateUrl: './message-preview.html',
  styleUrl: './message-preview.scss',
})
export class MessagePreview {
  protected readonly session = inject(AuthSession);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly actionsPinned = signal(false);
  readonly message = input.required<PreviewMessage>();
  readonly compact = input(false);
  readonly showThread = output<void>();
  protected readonly overlay = inject(OverlayState);
  protected readonly optionsOpen = signal(false);
  protected readonly editing = signal(false);
  protected readonly draft = signal('');

  protected openProfile(): void {
    const personId = examplePeople.find((person) => person.name === this.message().author)?.id;
    this.overlay.open('profile', { personId });
  }

  protected edit(): void {
    this.draft.set(this.message().text);
    this.optionsOpen.set(false);
    this.editing.set(true);
  }

  protected closeOutside(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.closeActions();
  }

  protected closeActions(): void {
    this.optionsOpen.set(false);
    this.actionsPinned.set(false);
  }
}
