import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const paths = {
  compose: 'M13 5H4v15h15v-9M10 14l1-4L19 2l3 3-8 8-4 1Z',
  'check-circle': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM7 12l3 3 7-7',
  'user-circle':
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 19v-2c0-4 12-4 12 0v2',
  logout: 'M10 3H4v18h6M9 12h12M17 8l4 4-4 4',
  pencil: 'm4 16-1 5 5-1L21 7l-4-4L4 16ZM14 6l4 4',
  'user-add': '',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  reaction: 'M20 12a8 8 0 1 1-8-8M19 2v6M16 5h6M8 10h.01M13 10h.01M7 14q4 5 8 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  chevron: 'm6 9 6 6 6-6',
  hash: 'M5 9h15M4 15h15M11 3 7 21M17 3l-4 18',
  message: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z',
  thread: 'M9 4h12v10H9zM3 8v12h13M13 8h4M13 11h2',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'm12 5-7 7 7 7M5 12h15',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  plus: 'M12 5v14M5 12h14',
  send: 'm3 3 18 9-18 9 4-9-4-9ZM7 12h14',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4M12 15v1',
  user: 'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  mail: 'M3 5h18v14H3zM3 5l9 7 9-7',
  edit: 'M13 5H4v15h15v-9M10 14l1-4L19 2l3 3-8 8-4 1Z',
  channels:
    'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM5 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM19 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  smile: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM8 9h.01M16 9h.01M7 14a5 5 0 0 0 10 0',
  at: 'M16 8v7c0 4 7 2 6-4a10 10 0 1 0-5 10M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  panel: 'M3 4h18v16H3zM9 4v16M16 9l-3 3 3 3',
} as const;
const assets: Partial<Record<keyof typeof paths, string>> = {
  'user-add': 'person-add',
  send: 'send-icon',
  reaction: 'add-reaction',
  thread: 'add-answer',
  more: 'more-options',
  lock: 'lock',
  mail: 'mail',
  user: 'person',
  edit: 'edit',
  channels: 'workspaces',
  hash: 'tag-black',
  smile: 'emoji-gray',
  at: 'alternate-email-gray',
};

/** Renders the shared inline SVG symbol selected by the caller, keeping decorative icons out of the accessibility tree. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (asset(); as url) {
      <span class="asset" [style.mask-image]="url" aria-hidden="true"></span>
    } @else {
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path [attr.d]="paths[name()]" />
      </svg>
    }`,
  styles: `
    :host {
      display: inline-flex;
      width: 1.5rem;
      height: 1.5rem;
      flex: 0 0 auto;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    .asset {
      width: 100%;
      height: 100%;
      background: currentColor;
      mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
    }
  `,
})
export class Icon {
  readonly name = input.required<keyof typeof paths>();
  protected readonly paths = paths;
  protected readonly asset = computed(() =>
    assets[this.name()] ? 'url("/assets/images/original/' + assets[this.name()] + '.svg")' : null,
  );
}
