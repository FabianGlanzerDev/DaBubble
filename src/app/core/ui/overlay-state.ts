import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { MobileOverlayHistory } from './mobile-overlay-history';

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

@Injectable({ providedIn: 'root' })
export class OverlayState {
  private readonly document = inject(DOCUMENT);
  private readonly history = inject(MobileOverlayHistory);
  private historyOpen = false;
  readonly current = signal<OverlayContext | null>(null);
  readonly closing = signal(false);
  private returnFocus: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  open(type: OverlayType, context: Omit<OverlayContext, 'type'> = {}): void {
    clearTimeout(this.closeTimer);
    if (!this.current()) this.returnFocus = this.document.activeElement as HTMLElement | null;
    this.closing.set(false);
    this.current.set({ type, ...context });
    this.history.open(this.current()!);
  }

  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.closeTimer = setTimeout(() => {
      if (!this.history.dismiss()) this.current.set(null);
    }, 200);
  }

  restoreFocus(): void {
    if (this.returnFocus?.isConnected && this.returnFocus.checkVisibility())
      this.returnFocus.focus();
    this.returnFocus = null;
  }

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

  closeForNavigation(): void {
    this.historyOpen = false;
    clearTimeout(this.closeTimer);
    this.returnFocus = null;
    this.current.set(null);
    this.closing.set(false);
  }
}
