import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EnvironmentInjector,
  afterNextRender,
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
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';

/** Edits real channel metadata and membership with inline validation and per-action error state. */
@Component({
  selector: 'app-live-channel-dialog',
  imports: [NgTemplateOutlet, Icon, LiveMemberList, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-channel-dialog.html',
  styleUrls: ['../overlays/channel-panel.scss', './live-channel-dialog.scss'],
})
export class LiveChannelDialog {
  protected readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  private readonly router = inject(Router);
  private readonly injector = inject(EnvironmentInjector);
  private createdId: string | undefined;
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

  /** Synchronizes untouched fields with live room updates and restores focus after edit transitions. */
  constructor() {
    effect(() => {
      const room = this.room();
      if (!this.nameEdited()) this.name.set(room?.name ?? '');
      if (!this.descriptionEdited()) this.description.set(room?.description ?? '');
    });
    afterRenderEffect(() => this.focusField());
  }

  /** Focuses the active editor or its edit button after saving, without disturbing an in-flight action. */
  private focusField(): void {
    if (this.action.busy()) return;
    if (this.editing() === 'name') this.nameInput()?.nativeElement.focus();
    else if (this.editing() === 'description') this.descriptionInput()?.nativeElement.focus();
    else if (this.lastEdited)
      this.element.nativeElement
        .querySelector<HTMLButtonElement>('[aria-label="Bearbeiten: ' + this.lastEdited + '"]')
        ?.focus();
  }

  /** Resets field-edit tracking and records the control that should regain focus after saving. */
  protected startEdit(field: 'name' | 'description'): void {
    this.action.error.set('');
    this.nameEdited.set(false);
    this.descriptionEdited.set(false);
    this.lastEdited = field === 'name' ? 'Channel-Name' : 'Beschreibung';
    this.editing.set(field);
  }

  /** Validates channel naming before updating an existing room or creating and opening a new one. */
  protected save(): void {
    this.nameTouched.set(true);
    if (this.validation()) return;
    if (this.room()) this.saveField('name');
    else void this.action.run(() => this.create());
  }

  /** Reuses a persisted channel on navigation retries and respects dismissal during creation. */
  private async create(): Promise<void> {
    const context = this.overlay.current();
    this.createdId ??= await this.store.create(this.name(), this.description());
    if (this.overlay.current() !== context || this.overlay.closing()) return;
    const replaceUrl = !!this.router.parseUrl(this.router.url).queryParams['dialog'];
    if (await this.router.navigate(['/chat/channels', this.createdId], { replaceUrl }))
      this.offerMembers(this.createdId);
  }

  /** Opens the second step after rendering without reviving a dismissed or superseded dialog. */
  private offerMembers(channelId: string): void {
    afterNextRender(
      () => {
        if (!this.overlay.current() && this.router.url === '/chat/channels/' + channelId)
          this.overlay.open('channel-people', { live: true, channelId });
      },
      { injector: this.injector },
    );
  }

  /** Persists only the selected editable field while retaining the other field's live value. */
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

  /** Opens the profile associated with the room's recorded creator UID. */
  protected creator(): void {
    this.overlay.open('profile', { live: true, personId: this.room()?.createdBy });
  }

  /** Navigates to the workspace overview only after the current user's membership has been removed. */
  protected leave(): void {
    void this.action.run(async () => {
      await this.store.leave(this.room()!.id);
      await this.router.navigate(['/chat']);
    });
  }
}
