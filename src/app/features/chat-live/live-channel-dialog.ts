import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { channelNameError } from '../../core/chat/chat-models';
import { OverlayState } from '../../core/ui/overlay-state';
import { Icon } from '../../shared/ui/icon';
import { LiveMemberList } from './live-member-list';

@Component({
  selector: 'app-live-channel-dialog',
  imports: [NgTemplateOutlet, Icon, LiveMemberList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-channel-dialog.html',
  styleUrls: ['../overlays/channel-panel.scss', './live-channel-dialog.scss'],
})
export class LiveChannelDialog {
  protected readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private lastEdited = '';
  protected readonly room = computed(() =>
    this.store.rooms().find((room) => room.id === this.overlay.current()?.channelId),
  );
  protected readonly name = signal(this.room()?.name ?? '');
  protected readonly nameTouched = signal(false);
  protected readonly nameEdited = signal(false);
  protected readonly description = signal(this.room()?.description ?? '');
  protected readonly descriptionEdited = signal(false);
  protected readonly editing = signal<'name' | 'description' | null>(null);
  protected readonly confirmLeave = signal(false);
  protected readonly action = new ChatAction();
  protected readonly validation = computed(() => channelNameError(this.name()));
  protected readonly error = computed(
    () => this.action.error() || (this.nameTouched() || this.name() ? this.validation() : ''),
  );
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly descriptionInput =
    viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');

  constructor() {
    effect(() => {
      const room = this.room();
      if (!this.nameEdited()) this.name.set(room?.name ?? '');
      if (!this.descriptionEdited()) this.description.set(room?.description ?? '');
    });
    afterRenderEffect(() => this.focusField());
  }

  private focusField(): void {
    if (this.action.busy()) return;
    if (this.editing() === 'name') this.nameInput()?.nativeElement.focus();
    else if (this.editing() === 'description') this.descriptionInput()?.nativeElement.focus();
    else if (this.lastEdited)
      this.element.nativeElement
        .querySelector<HTMLButtonElement>('[aria-label="Bearbeiten: ' + this.lastEdited + '"]')
        ?.focus();
  }

  protected startEdit(field: 'name' | 'description'): void {
    this.action.error.set('');
    this.nameEdited.set(false);
    this.descriptionEdited.set(false);
    this.lastEdited = field === 'name' ? 'Channel-Name' : 'Beschreibung';
    this.editing.set(field);
  }

  protected save(): void {
    this.nameTouched.set(true);
    if (this.validation()) return;
    if (this.room()) this.saveField('name');
    else
      void this.action.run(async () => {
        const id = await this.store.create(this.name(), this.description());
        await this.router.navigate(['/chat/channels', id]);
      });
  }

  protected saveField(field: 'name' | 'description'): void {
    if (field === 'name' && this.validation()) return;
    void this.action.run(async () => {
      const room = this.room()!;
      await this.store.editRoom(
        room,
        field === 'name' ? this.name() : room.name,
        field === 'description' ? this.description() : room.description,
      );
      this.nameEdited.set(false);
      this.descriptionEdited.set(false);
      this.editing.set(null);
    });
  }

  protected creator(): void {
    this.overlay.open('profile', { live: true, personId: this.room()?.createdBy });
  }

  protected leave(): void {
    void this.action.run(async () => {
      await this.store.leave(this.room()!.id);
      await this.router.navigate(['/chat']);
    });
  }
}
