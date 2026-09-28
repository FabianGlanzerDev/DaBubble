/** Cancels older sign-in attempts across tabs without storing credentials or user identifiers. */
export class LogoutFence {
  private current = '';
  private readonly channel: BroadcastChannel | null;
  private readonly key: string;

  /** Scopes cross-tab logout notifications to the configured Firebase project. */
  constructor(projectId: string) {
    this.key = `dabubble.logout.${projectId}`;
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(this.key);
    if (this.channel)
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') this.current = event.data;
      };
  }

  /** Combines persisted and live logout markers, tolerating blocked browser storage. */
  version(): string {
    try {
      return `${localStorage.getItem(this.key) ?? ''}:${this.current}`;
    } catch {
      return this.current;
    }
  }

  /** Invalidates pending sign-ins in other tabs using storage and a live broadcast. */
  publish(): void {
    this.current = crypto.randomUUID();
    try {
      localStorage.setItem(this.key, this.current);
    } catch {
      // BroadcastChannel still synchronizes running tabs if local storage is blocked.
    }
    this.channel?.postMessage(this.current);
  }

  /** Closes the cross-tab channel when the Firebase runtime is disposed. */
  destroy(): void {
    this.channel?.close();
  }
}
