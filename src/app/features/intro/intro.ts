import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthPage } from '../auth/auth-page';

/** Plays the branded entry sequence on each visit before forwarding preserved login parameters. */
@Component({
  selector: 'app-intro',
  imports: [AuthPage],
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
    </main>`,
  styleUrl: './intro.scss',
})
export class Intro {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  protected readonly departing = signal(false);

  /** Starts animation timing only after the introduction has been rendered. */
  constructor() {
    afterNextRender(() => this.startIntro());
  }

  /** Plays on every entry; reduced motion keeps a brief static introduction. */
  private startIntro(): void {
    this.removeLegacyMarker();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = setTimeout(() => this.departing.set(true), reduced ? 250 : 3500);
    const finish = setTimeout(() => this.finishIntro(), reduced ? 500 : 5000);
    this.destroy.onDestroy(() => {
      clearTimeout(reveal);
      clearTimeout(finish);
    });
  }

  /** Remove only the obsolete intro preference, never authentication or chat storage. */
  private removeLegacyMarker(): void {
    try {
      localStorage.removeItem('dabubble-intro-played');
    } catch {
      /* Animation does not require browser storage. */
    }
  }

  /** Replaces the intro history entry with login while preserving return parameters and discarding the replay marker. */
  private finishIntro(): void {
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['replay'];
    void this.router.navigate(['/anmeldung'], { queryParams, replaceUrl: true });
  }
}
