import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-feature-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="notice">
    <span class="dot" aria-hidden="true"></span>
    <p>{{ text() }}</p>
  </div>`,
  styles: `
    .notice {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 0.85rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-small);
      background: var(--surface-soft);
      color: var(--text-secondary);
      font-size: 0.875rem;
      line-height: 1.5;
    }
    p {
      margin: 0;
    }
    .dot {
      width: 0.45rem;
      height: 0.45rem;
      background: var(--accent);
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 0.45rem;
    }
  `,
})
export class FeatureNotice {
  readonly text = input.required<string>();
}
