import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatStore } from '../../core/chat/chat-store';
import { ChatAction } from '../../core/chat/chat-action';
import { channelNameError } from '../../core/chat/chat-models';
import { OverlayState } from '../../core/ui/overlay-state';

@Component({
  selector: 'app-live-channel-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form (submit)="$event.preventDefault(); save()" [attr.aria-busy]="action.busy()">
    <label for="channel-name">Channel-Name</label>
    <input
      id="channel-name"
      [value]="name()"
      (input)="name.set($any($event.target).value)"
      maxlength="80"
      required
      [attr.aria-invalid]="!!validation()"
      aria-describedby="channel-error"
    />
    <label for="channel-description">Beschreibung (optional)</label>
    <textarea
      id="channel-description"
      [value]="description()"
      (input)="description.set($any($event.target).value)"
      rows="3"
      maxlength="1000"
    ></textarea>
    @if (room(); as channel) {
      <p>
        Erstellt von <strong>{{ store.person(channel.createdBy).name }}</strong>
      </p>
      <button type="button" class="button secondary" (click)="members()">
        {{ channel.memberIds.length }} Mitglieder verwalten
      </button>
    } @else {
      <p>Nach dem Erstellen kannst du Mitglieder hinzufügen.</p>
    }
    <p id="channel-error" class="action-error" role="alert">
      {{ action.error() || (name() ? validation() : '') }}
    </p>
    <div class="actions">
      <button class="button" type="submit" [disabled]="action.busy() || !!validation()">
        {{ action.busy() ? 'Wird gespeichert…' : room() ? 'Speichern' : 'Erstellen' }}
      </button>
    </div>
    @if (room()) {
      @if (confirmLeave()) {
        <p>Du verlierst den Zugriff auf diesen Channel und seine Nachrichten.</p>
        <div class="actions">
          <button class="button secondary" type="button" (click)="confirmLeave.set(false)">
            Abbrechen</button
          ><button class="button" type="button" [disabled]="action.busy()" (click)="leave()">
            Austritt bestätigen
          </button>
        </div>
      } @else {
        <button
          type="button"
          class="leave"
          [disabled]="action.busy()"
          (click)="confirmLeave.set(true)"
        >
          Channel verlassen
        </button>
      }
    }
  </form>`,
  styleUrl: './live-dialog.scss',
})
export class LiveChannelDialog {
  protected readonly store = inject(ChatStore);
  private readonly overlay = inject(OverlayState);
  private readonly router = inject(Router);
  protected readonly room = computed(() =>
    this.store.rooms().find((room) => room.id === this.overlay.current()?.channelId),
  );
  protected readonly name = signal(this.room()?.name ?? '');
  protected readonly description = signal(this.room()?.description ?? '');
  protected readonly confirmLeave = signal(false);
  protected readonly action = new ChatAction();
  protected readonly validation = computed(() => channelNameError(this.name()));

  protected save(): void {
    if (this.validation()) return;
    void this.action.run(async () => {
      const room = this.room();
      if (room) {
        await this.store.editRoom(room, this.name(), this.description());
        this.overlay.close();
      } else {
        const id = await this.store.create(this.name(), this.description());
        await this.router.navigate(['/chat/channels', id]);
      }
    });
  }

  protected members(): void {
    this.overlay.open('members', { live: true, channelId: this.room()?.id });
  }

  protected leave(): void {
    void this.action.run(async () => {
      await this.store.leave(this.room()!.id);
      await this.router.navigate(['/chat']);
    });
  }
}
