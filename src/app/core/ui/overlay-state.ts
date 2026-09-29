import { Injectable, inject, signal } from '@angular/core';
import { MobileOverlayHistory } from './mobile-overlay-history';

/** Supported real and preview dialog variants managed by the shared overlay host. */
export type OverlayType =
  | 'settings'
  | 'profile'
  | 'profile-edit'
  | 'avatar'
  | 'channel'
  | 'channel-create'
  | 'channel-people'
  | 'members'
  | 'add-members'
  | 'emoji'
  | 'confirmation'
  | 'reactions';
/** Dialog-specific IDs, presentation options and callbacks; this context grants no data access. */
export interface OverlayContext {
  readonly type: OverlayType;
  readonly account?: boolean;
  readonly live?: boolean;
  readonly messageId?: string;
  readonly personId?: string;
  readonly channelId?: string;
  readonly draftChannelName?: string;
  readonly title?: () => string;
  readonly onEmoji?: (emoji: string) => void;
  readonly kind?: 'account' | 'email' | 'signin';
  readonly anchor?: { readonly x: number; readonly y: number };
}

/** Coordinates dialog transitions and mobile history; the native modal host manages keyboard focus. */
@Injectable({ providedIn: 'root' })
export class OverlayState {
  private readonly history = inject(MobileOverlayHistory);
  private historyOpen = false;
  readonly current = signal<OverlayContext | null>(null);
  readonly closing = signal(false);
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Publishes the next dialog with matching mobile history and cancels any pending dismissal. */
  open(type: OverlayType, context: Omit<OverlayContext, 'type'> = {}): void {
    clearTimeout(this.closeTimer);
    this.closing.set(false);
    this.current.set({ type, ...context });
    this.history.open(this.current()!);
  }

  /** Allows the closing animation to finish before dismissing the dialog's history or state. */
  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.closeTimer = setTimeout(() => {
      if (!this.history.dismiss()) this.current.set(null);
    }, 200);
  }

  /** Replays stored dialog context or closes a mobile dialog after browser-history navigation. */
  syncNavigation(): boolean {
    const context = this.history.read();
    if (context) {
      this.historyOpen = true;
      this.closing.set(false);
      this.current.set(context);
      return true;
    }
    if (!this.historyOpen || !this.history.samePage()) return false;
    this.historyOpen = false;
    clearTimeout(this.closeTimer);
    this.current.set(null);
    return true;
  }

  /** Clears a dialog immediately when changing pages, without focusing controls on the departing page. */
  closeForNavigation(): void {
    this.historyOpen = false;
    clearTimeout(this.closeTimer);
    this.current.set(null);
    this.closing.set(false);
  }
}
