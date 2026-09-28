import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { OverlayState } from '../../core/ui/overlay-state';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { examplePeople } from '../chat/workspace-people';

/** Demonstrates member search and selection using example people without changing real membership. */
@Component({
  selector: 'app-members-panel',
  imports: [AvatarImage, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './members-panel.html',
  styleUrl: './members-panel.scss',
})
export class MembersPanel {
  readonly embedded = input(false);
  protected readonly overlay = inject(OverlayState);
  protected readonly listing = computed(
    () => this.embedded() || this.overlay.current()?.type === 'members',
  );
  protected readonly choosing = computed(() => this.overlay.current()?.type === 'channel-people');
  protected readonly all = signal(true);
  protected readonly query = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly members = examplePeople.slice(0, 3);
  protected readonly people = examplePeople;
  protected readonly results = computed(() =>
    examplePeople.filter(
      (person) =>
        person.name.toLocaleLowerCase().includes(this.query().toLocaleLowerCase()) &&
        !this.selected().includes(person.id),
    ),
  );

  /** Updates local filtering from the example member-search field. */
  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Adds an example person to the pending selection and clears the search query. */
  protected select(id: string): void {
    this.selected.update((ids) => [...ids, id]);
    this.query.set('');
  }

  /** Removes a pending example selection without touching any stored conversation. */
  protected remove(id: string): void {
    this.selected.update((ids) => ids.filter((selected) => selected !== id));
  }
}
