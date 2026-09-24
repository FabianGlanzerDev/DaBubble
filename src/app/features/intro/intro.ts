import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthPage } from '../auth/auth-page';

@Component({
  selector: 'app-intro',
  imports: [RouterLink, AuthPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="destination" inert aria-hidden="true">
      <app-auth-page [embedded]="true" />
    </div>
    <main id="main-content" class="intro" [class.departing]="departing()" tabindex="-1">
      <h1 class="sr-only" data-page-heading tabindex="-1">Willkommen bei DABubble</h1>
      <div class="intro-background"></div>
      <div class="animated-brand" aria-hidden="true">
        <div class="brand-line">
          <img src="assets/images/original/logo-solo.png" width="80" height="70" alt="" />
          <div class="word-clip"><span>DABubble</span></div>
        </div>
      </div>
      <a
        class="skip-intro"
        routerLink="/anmeldung"
        (click)="rememberIntro()"
        aria-label="Zur Anmeldung"
        >Intro überspringen</a
      >
    </main>`,
  styleUrl: './intro.scss',
})
export class Intro {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  protected readonly departing = signal(false);

  constructor() {
    afterNextRender(() => this.startIntro());
  }

  private startIntro(): void {
    if (this.shouldSkipIntro()) {
      this.finishIntro();
      return;
    }
    const reveal = setTimeout(() => this.departing.set(true), 3500);
    const finish = setTimeout(() => this.finishIntro(), 5000);
    this.destroy.onDestroy(() => {
      clearTimeout(reveal);
      clearTimeout(finish);
    });
  }

  private shouldSkipIntro(): boolean {
    const replay = this.route.snapshot.queryParamMap.get('replay') === 'true';
    return matchMedia('(prefers-reduced-motion: reduce)').matches || (!replay && this.hasPlayed());
  }

  private hasPlayed(): boolean {
    try {
      return localStorage.getItem('dabubble-intro-played') === 'true';
    } catch {
      return false;
    }
  }

  protected rememberIntro(): void {
    try {
      localStorage.setItem('dabubble-intro-played', 'true');
    } catch {
      /* The animation also works when storage is unavailable. */
    }
  }

  private finishIntro(): void {
    this.rememberIntro();
    void this.router.navigateByUrl('/anmeldung', { replaceUrl: true });
  }
}
