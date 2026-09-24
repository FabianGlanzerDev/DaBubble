import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicLayout } from '../../shared/layout/public-layout';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { Icon } from '../../shared/ui/icon';
import { RegistrationPreview } from './registration-preview';
import { AuthSession } from '../../core/auth/auth-session';
import { authIssue } from '../../core/auth/auth-errors';
import { FormField } from '../../shared/ui/form-field';

@Component({
  selector: 'app-avatar-page',
  imports: [PublicLayout, RouterLink, AvatarImage, Icon, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-public-layout variant="avatar"
    ><div class="auth-screen">
      <section class="auth-card" aria-labelledby="avatar-title" aria-describedby="avatar-note">
        <header class="card-heading">
          <a
            class="back-link icon-button"
            [routerLink]="realAccount ? '/anmeldung' : '/registrierung'"
            [attr.aria-label]="realAccount ? 'Zur Anmeldung' : 'Zur Registrierung'"
            ><app-icon name="arrow"
          /></a>
          <h1 id="avatar-title" data-page-heading tabindex="-1">Wähle deinen Avatar</h1>
        </header>
        <div class="selected-avatar"><app-avatar-image [index]="selection()" [size]="168" /></div>
        <h2>{{ realAccount ? name() : registration.name() }}</h2>
        @if (needsName) {
          <app-form-field
            fieldId="profile-setup-name"
            kind="name"
            label="Name"
            placeholder="Name und Nachname"
            [(value)]="name"
            [disabled]="session.busy()"
          />
        }
        <p class="list-label">Aus der Liste wählen</p>
        <div class="avatar-options" role="group" aria-label="Avatar-Vorschau auswählen">
          @for (avatar of avatars; track avatar) {
            <button
              type="button"
              [attr.aria-label]="'Avatar ' + (avatar + 1)"
              [attr.aria-pressed]="selection() === avatar"
              (click)="selection.set(avatar)"
              [disabled]="realAccount && session.busy()"
            >
              <app-avatar-image [index]="avatar" />
            </button>
          }
        </div>
        <div class="continue-row">
          <button
            class="auth-button"
            type="button"
            [disabled]="
              !realAccount ||
              selection() === null ||
              !name().trim() ||
              name().trim().length > 80 ||
              session.busy()
            "
            (click)="save()"
            aria-describedby="avatar-note"
          >
            {{ session.pending() === 'profile' ? 'Profil wird gespeichert…' : 'Weiter' }}
          </button>
        </div>
        @if (error()) {
          <p class="action-error" role="alert">{{ error() }}</p>
        }
      </section>
      <aside class="preview-note" aria-label="Stand der Vorschau">
        <p id="avatar-note">
          @if (realAccount) {
            Dein Konto ist angelegt. Wähle einen Avatar, um dein Profil zu vervollständigen.
            @if (session.emulated()) {
              Lokaler Firebase-Emulator.
            }
          } @else {
            Layout-Vorschau · Beispielprofil. Die Auswahl wird nicht gespeichert; es wird kein Konto
            erstellt.
          }
        </p>
        <nav aria-label="Weitere Designvorschauen">
          <a routerLink="/vorschau">Layout-Vorschau öffnen</a>
          <a routerLink="/meldungen-vorschau">Bestätigungsmeldungen ansehen</a>
        </nav>
      </aside>
    </div></app-public-layout
  >`,
  styleUrl: './avatar-page.scss',
})
export class AvatarPage {
  protected readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  protected readonly realAccount = !!inject(ActivatedRoute).snapshot.data['account'];
  protected readonly name = signal(this.session.profile()?.name ?? this.session.pendingName());
  protected readonly needsName = this.realAccount && !this.name();
  protected readonly error = signal('');
  protected readonly registration = inject(RegistrationPreview);
  protected readonly avatars = [0, 1, 2, 3, 4, 5] as const;
  protected readonly selection = signal<number | null>(
    this.realAccount ? (this.session.profile()?.avatarId ?? null) : null,
  );

  protected async save(): Promise<void> {
    const avatarId = this.selection();
    if (!this.realAccount || avatarId === null || this.session.busy()) return;
    this.error.set('');
    try {
      await this.session.saveProfile({ name: this.name(), avatarId });
      await this.router.navigateByUrl('/chat');
    } catch (error) {
      this.error.set(authIssue(error).message);
    }
  }
}
