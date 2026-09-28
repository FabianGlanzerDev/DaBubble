import { signal } from '@angular/core';
import { chatError } from './chat-models';

/** Each independent action owns its pending/error state and rejects double submission. */
export class ChatAction {
  readonly busy = signal(false);
  readonly error = signal('');

  /** Suppresses duplicate submissions and exposes safe chat feedback while always releasing the busy state. */
  async run(operation: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await operation();
    } catch (error) {
      this.error.set(chatError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
