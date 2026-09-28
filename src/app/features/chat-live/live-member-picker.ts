import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { ChatRoom } from '../../core/chat/chat-models';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';

/** Collects directory members for a real invitation while retaining pending and failed action feedback. */
@Component({
  selector: 'app-live-member-picker',
  imports: [AvatarImage, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-member-picker.html',
  styleUrl: './live-member-picker.scss',
})
export class LiveMemberPicker {
  readonly room = input.required<ChatRoom>();
  protected readonly store = inject(ChatStore);
  protected readonly action = new ChatAction();
  protected readonly query = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly saved = signal(false);
  protected readonly candidates = computed(() =>
    this.store
      .people()
      .filter(
        (person) =>
          !this.room().memberIds.includes(person.uid) &&
          !this.selected().includes(person.uid) &&
          person.name.toLocaleLowerCase().includes(this.query().trim().toLocaleLowerCase()),
      ),
  );

  /** Adds a candidate to the pending selection and returns focus to the cleared search field. */
  protected select(uid: string, field: HTMLInputElement): void {
    this.selected.update((ids) => [...ids, uid]);
    this.query.set('');
    this.saved.set(false);
    field.focus();
  }

  /** Removes a pending candidate without changing persisted membership and restores search focus. */
  protected remove(uid: string, field: HTMLInputElement): void {
    this.selected.update((ids) => ids.filter((id) => id !== uid));
    field.focus();
  }

  /** Clears the pending selection only after all requested membership additions succeed. */
  protected add(): void {
    void this.action.run(async () => {
      await this.store.invite(this.room().id, this.selected());
      this.selected.set([]);
      this.saved.set(true);
    });
  }
}
