import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { OverlayState } from '../../core/ui/overlay-state';
import { AvatarImage } from '../../shared/ui/avatar-image';

@Component({
  selector: 'app-live-members-dialog',
  imports: [AvatarImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (room(); as channel) {
      <p># {{ channel.name }}</p>
      <ul class="people">
        @for (id of channel.memberIds; track id) {
          <li>
            <button type="button" (click)="profile(id)">
              <app-avatar-image [index]="store.person(id).avatarId" [size]="50" />{{
                store.person(id).name
              }}
            </button>
          </li>
        }
      </ul>
      <label for="member-query">Leute hinzufügen</label>
      <input
        id="member-query"
        placeholder="Name suchen"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
      <ul class="people">
        @for (person of candidates(); track person.uid) {
          <li>
            <label
              ><input
                type="checkbox"
                [checked]="selected().includes(person.uid)"
                (change)="toggle(person.uid)"
                [disabled]="action.busy()"
              />
              <app-avatar-image [index]="person.avatarId" [size]="40" />{{ person.name }}</label
            >
          </li>
        } @empty {
          <li>Keine weiteren passenden Mitglieder.</li>
        }
      </ul>
      <p class="action-error" role="alert">{{ action.error() }}</p>
      @if (saved()) {
        <p role="status">Mitglieder hinzugefügt.</p>
      }
      <div class="actions">
        <button
          type="button"
          class="button"
          [disabled]="!selected().length || action.busy()"
          (click)="add()"
        >
          {{ action.busy() ? 'Wird hinzugefügt…' : 'Hinzufügen' }}
        </button>
      </div>
    } @else {
      <p>Dieser Channel ist nicht mehr verfügbar.</p>
    }`,
  styleUrl: './live-dialog.scss',
})
export class LiveMembersDialog {
  protected readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  protected readonly action = new ChatAction();
  protected readonly room = computed(() =>
    this.store.rooms().find((room) => room.id === this.overlay.current()?.channelId),
  );
  protected readonly query = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly saved = signal(false);
  protected readonly candidates = computed(() =>
    this.store
      .people()
      .filter(
        (person) =>
          !this.room()?.memberIds.includes(person.uid) &&
          person.name.toLocaleLowerCase().includes(this.query().toLocaleLowerCase()),
      ),
  );

  protected toggle(uid: string): void {
    this.selected.update((ids) =>
      ids.includes(uid) ? ids.filter((id) => id !== uid) : [...ids, uid],
    );
  }

  protected profile(uid: string): void {
    this.overlay.open('profile', { live: true, personId: uid });
  }

  protected add(): void {
    void this.action.run(async () => {
      await this.store.invite(this.room()!.id, this.selected());
      this.selected.set([]);
      this.saved.set(true);
    });
  }
}
