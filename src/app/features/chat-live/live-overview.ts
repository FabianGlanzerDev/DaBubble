import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OverlayState } from '../../core/ui/overlay-state';
import { LiveSearch } from './live-search';

@Component({
  selector: 'app-live-overview',
  imports: [LiveSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1 data-page-heading tabindex="-1">Neue Nachricht</h1>
    <app-live-search [recipient]="true" fieldId="recipient-search" />
    <p>
      Wähle einen Channel mit # oder eine Person mit @. Nachrichten werden nur an die Mitglieder
      dieses Gesprächs gesendet.
    </p>
    <button class="button" type="button" (click)="overlay.open('channel-create', { live: true })">
      Channel erstellen
    </button>`,
  styles: `
    :host {
      display: block;
      padding: 32px;
    }
    h1 {
      font-size: 24px;
    }
    p {
      margin: 40px 0;
      color: var(--text-secondary);
    }
    @media (max-width: 767px) {
      :host {
        padding: 16px;
      }
    }
  `,
})
export class LiveOverview {
  protected readonly overlay = inject(OverlayState);
}
