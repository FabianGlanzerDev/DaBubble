import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Original SVG assets supplied with the accepted comparison project. */
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
            : 'assets/images/original/avatar-option-' + assetOrder[index() ?? 0] + '.svg'
        "
        [width]="size()"
        [height]="size()"
        alt=""
    /></picture>
    @if (presence()) {
      <span class="presence" [class.away]="presence() === 'away'"></span>
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
      background: #92c83e;
    }
    .presence.away {
      background: #686868;
    }
    img {
      display: block;
      border-radius: 50%;
    }
  `,
})
export class AvatarImage {
  protected readonly assetOrder = [1, 2, 6, 3, 5, 4] as const;
  readonly index = input<number | null>(null);
  readonly size = input(64);
  readonly presence = input<'active' | 'away' | null>(null);
}
