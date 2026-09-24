import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';

@Component({
  selector: 'app-account-status',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="account-status" aria-labelledby="account-title">
    <h1 id="account-title" data-page-heading tabindex="-1">Dein Benutzerprofil</h1>
    @if (session.profileLoading()) {
      <p role="status">Dein Profil wird geladen…</p>
    } @else if (session.profileError()) {
      <p class="action-error" role="alert">{{ session.profileError() }}</p>
      <button class="button" type="button" (click)="session.reloadProfile()">Erneut laden</button>
    } @else {
      <p>Dein Konto ist angemeldet. Bitte vervollständige noch deinen Namen und Avatar.</p>
      <a class="button" routerLink="/avatar-auswahl">Profil vervollständigen</a>
    }
  </section>`,
  styles: `
    .account-status {
      padding: 32px;
      overflow-wrap: anywhere;
    }
    h1 {
      font-size: 28px;
    }
  `,
})
export class AccountStatus {
  protected readonly session = inject(AuthSession);
}
