import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OverlayState } from '../../core/ui/overlay-state';
import { channels } from '../chat/workspace-items';
import { Icon } from '../../shared/ui/icon';
import { MembersPanel } from './members-panel';

@Component({
  selector: 'app-channel-panel',
  imports: [Icon, MembersPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './channel-panel.html',
  styleUrl: './channel-panel.scss',
})
export class ChannelPanel {
  protected readonly overlay = inject(OverlayState);
  protected readonly creating = computed(() => this.overlay.current()?.type === 'channel-create');
  protected readonly label = computed(
    () =>
      channels.find((channel) => channel.id === this.overlay.current()?.channelId)?.label ??
      'Entwicklerteam',
  );
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly editName = signal(false);
  protected readonly editDescription = signal(false);
  protected readonly touched = signal(false);
  protected readonly descriptionExample =
    'Dieser Channel ist für alles rund um #dfsdf vorgesehen. Hier kannst du zusammen mit deinem Team Meetings abhalten, Dokumente teilen und Entscheidungen treffen.';
  protected readonly duplicate = computed(() =>
    channels.some(
      (channel) => channel.label.toLocaleLowerCase() === this.name().trim().toLocaleLowerCase(),
    ),
  );
  protected readonly nameError = computed(() =>
    !this.name().trim()
      ? 'Bitte gib einen Channel-Namen ein.'
      : this.duplicate()
        ? 'Dieser Name gehört bereits zu einem Beispiel-Channel.'
        : '',
  );

  protected changeName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.touched.set(true);
  }

  protected changeDescription(event: Event): void {
    this.description.set((event.target as HTMLInputElement).value);
  }

  protected startNameEdit(): void {
    this.name.set(this.label());
    this.editName.set(true);
  }

  protected showPeople(): void {
    if (this.nameError()) return;
    this.overlay.open('channel-people', { draftChannelName: this.name().trim() });
  }
}
