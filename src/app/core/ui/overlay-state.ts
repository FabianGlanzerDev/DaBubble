import { DOCUMENT } from '@angular/common';
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

/** Coordinates dialog transitions, mobile history and restoration of the opening control's focus. */
@Injectable({ providedIn: 'root' })
export class OverlayState {
  private readonly document = inject(DOCUMENT);
  private readonly history = inject(MobileOverlayHistory);
  private historyOpen = false;
  readonly current = signal<OverlayContext | null>(null);
  readonly closing = signal(false);
  private returnFocus: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Captures the original focus target and publishes the next dialog with matching mobile history. */
  open(type: OverlayType, context: Omit<OverlayContext, 'type'> = {}): void {
    clearTimeout(this.closeTimer);
    if (!this.current()) this.returnFocus = this.document.activeElement as HTMLElement | null;
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

  /** Restores keyboard focus only when the original control still exists and is visible. */
  restoreFocus(): void {
    if (this.returnFocus?.isConnected && this.returnFocus.checkVisibility())
      this.returnFocus.focus();
    this.returnFocus = null;
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
    this.returnFocus = null;
    this.current.set(null);
    this.closing.set(false);
  }
}
