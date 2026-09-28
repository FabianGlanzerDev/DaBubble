/** Cancels older sign-in attempts across tabs without storing credentials or user identifiers. */
export class LogoutFence {
  private current = '';
  private readonly channel: BroadcastChannel | null;
  private readonly key: string;

  constructor(projectId: string) {
    this.key = `dabubble.logout.${projectId}`;
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(this.key);
    if (this.channel)
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') this.current = event.data;
      };
  }

  version(): string {
    try {
      return `${localStorage.getItem(this.key) ?? ''}:${this.current}`;
    } catch {
      return this.current;
    }
  }

  publish(): void {
    this.current = crypto.randomUUID();
    try {
      localStorage.setItem(this.key, this.current);
    } catch {
      // BroadcastChannel still synchronizes running tabs if local storage is blocked.
    }
    this.channel?.postMessage(this.current);
  }

  destroy(): void {
    this.channel?.close();
  }
}
