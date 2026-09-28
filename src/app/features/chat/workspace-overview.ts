import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MessageComposer } from './message-composer';
import { WorkspaceSearch } from './workspace-search';

/** Shows the preview's initial conversation-selection state and example recipient search. */
@Component({
  selector: 'app-workspace-overview',
  imports: [MessageComposer, WorkspaceSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header>
      <h1 data-page-heading tabindex="-1">Neue Nachricht</h1>
      <app-workspace-search fieldId="recipient-search" [recipient]="true" />
    </header>
    <div class="space"></div>
    <app-message-composer fieldId="new-message-draft" placeholder="Starte eine neue Nachricht" />`,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 500px;
      min-width: 0;
    }
    header {
      padding: 32px 45px 20px;
      box-shadow: 0 3px 5px #0000000d;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 20px;
    }
    .space {
      flex: 1;
    }
    app-message-composer {
      margin: 20px 35px 40px;
    }
    @media (max-width: 767px) {
      :host {
        min-height: 0;
      }
      h1 {
        font-size: 20px;
      }
      header {
        padding: 20px 16px;
      }
      app-message-composer {
        margin: 12px 16px 20px;
      }
    }
  `,
})
export class WorkspaceOverview {}
