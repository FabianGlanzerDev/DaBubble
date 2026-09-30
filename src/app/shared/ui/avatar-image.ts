import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PresenceState } from '../../core/presence/presence-state';

/** Renders local lossless avatar artwork while retaining the persisted numeric avatar mapping. */
@Component({
  selector: 'app-avatar-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<picture>
      @if (index() === null) {
        <source media="(max-width: 767px)" srcset="assets/images/original/no-avatar-mobile.svg" />
      }
      <img
        [src]="
          index() === null
            ? 'assets/images/original/no-avatar.svg'
            : 'assets/images/original/avatar-option-' + assetOrder[index() ?? 0] + '.webp'
        "
        [width]="size()"
        [height]="size()"
        alt=""
    /></picture>
    @if (uid()) {
      <span class="presence" [attr.data-presence]="status()" [title]="state.label(uid()!)"></span>
    }`,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      flex: 0 0 auto;
    }
    .presence {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 14px;
      height: 14px;
      border: 2px solid white;
      border-radius: 50%;
      background: white;
      box-shadow: inset 0 0 0 1px #686868;
    }
    .presence[data-presence='online'] {
      background: #92c83e;
      box-shadow: none;
    }
    .presence[data-presence='offline'] {
      background: #686868;
      box-shadow: none;
    }
    img {
      display: block;
      border-radius: 50%;
    }
  `,
})
export class AvatarImage {
  protected readonly assetOrder = [1, 2, 6, 3, 5, 4] as const;
  protected readonly state = inject(PresenceState);
  protected readonly status = computed(() => this.state.status(this.uid() ?? ''));
  readonly index = input<number | null>(null);
  readonly size = input(64);
  readonly uid = input<string | null>(null);
}
