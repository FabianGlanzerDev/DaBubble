import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChatStore } from '../../core/chat/chat-store';
import { OverlayState } from '../../core/ui/overlay-state';
import { LiveMemberList } from './live-member-list';
import { LiveMemberPicker } from './live-member-picker';

/** Hosts the real member list and invitation controls for the selected conversation. */
@Component({
  selector: 'app-live-members-dialog',
  imports: [LiveMemberList, LiveMemberPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (room(); as channel) {
      @if (overlay.current()?.type === 'add-members') {
        <app-live-member-picker [room]="channel" />
      } @else {
        <app-live-member-list [room]="channel" />
      }
    } @else {
      <p>Dieser Channel ist nicht mehr verfügbar.</p>
    }`,
})
export class LiveMembersDialog {
  private readonly store = inject(ChatStore);
  protected readonly overlay = inject(OverlayState);
  protected readonly room = computed(() =>
    this.store.rooms().find((room) => room.id === this.overlay.current()?.channelId),
  );
}
