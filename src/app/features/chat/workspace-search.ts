import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { MobileNavigation } from '../../core/ui/mobile-navigation';
import { Icon } from '../../shared/ui/icon';
import { AvatarImage } from '../../shared/ui/avatar-image';
import { channels, directMessages } from './workspace-items';
import { findPerson } from './workspace-people';

/** Filters local example recipients with keyboard results and a history-backed mobile search view. */
@Component({
  selector: 'app-workspace-search',
  imports: [RouterLink, Icon, AvatarImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-search.html',
  styleUrl: './workspace-search.scss',
})
export class WorkspaceSearch {
  readonly mobileMenu = input(false);
  protected readonly mobile = inject(MobileNavigation);
  protected readonly basePath = inject(Router).url.startsWith('/chat') ? '/chat' : '/vorschau';
  readonly recipient = input(false);
  readonly fieldId = input('workspace-search');
  protected readonly query = signal('');
  protected readonly expanded = signal(false);
  protected readonly term = computed(() =>
    this.query().replace(/^[@#]/, '').trim().toLocaleLowerCase(),
  );
  protected readonly channelResults = computed(() =>
    this.query().startsWith('@')
      ? []
      : channels.filter((item) => item.label.toLocaleLowerCase().includes(this.term())),
  );
  protected readonly peopleResults = computed(() =>
    this.query().startsWith('#')
      ? []
      : directMessages.filter((item) =>
          (item.label + ' ' + findPerson(item.id).email).toLocaleLowerCase().includes(this.term()),
        ),
  );
  protected readonly messageMatch = computed(
    () =>
      !this.recipient() &&
      !!this.term() &&
      'Welche Version ist aktuell von Angular?'.toLocaleLowerCase().includes(this.term()),
  );
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');

  /** Expands filtered examples and enters the separate mobile search view when necessary. */
  protected changeQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.expanded.set(true);
    if (this.mobileMenu() && this.mobile.isMobile()) this.mobile.open('search');
  }

  /** Moves keyboard focus to the first preview result without following its link. */
  protected focusResults(event: Event): void {
    event.preventDefault();
    this.results()?.nativeElement.querySelector('a')?.focus();
  }

  /** Closes desktop results on focus exit while keeping the dedicated mobile search view open. */
  protected closeResults(event: FocusEvent): void {
    if (this.mobileMenu() && this.mobile.view() === 'search') return;
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
      this.expanded.set(false);
  }

  /** Clears the preview query and exits mobile search through the shared navigation history. */
  protected dismiss(): void {
    this.expanded.set(false);
    this.query.set('');
    if (this.mobileMenu() && this.mobile.view() === 'search') this.mobile.close();
  }
}
