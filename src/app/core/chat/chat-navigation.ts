import { Location } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ChatRoom } from './chat-models';
import { ChatStore } from './chat-store';

@Injectable({ providedIn: 'root' })
export class ChatNavigation {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly store = inject(ChatStore);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly tree = computed(() => this.router.parseUrl(this.url()));
  readonly roomId = computed(() => this.tree().root.children['primary']?.segments[2]?.path ?? '');
  readonly threadId = computed(() => String(this.tree().queryParams['thread'] ?? ''));
  readonly active = computed(() => this.url().split('?')[0] !== '/chat');

  path(room: ChatRoom): string[] {
    return ['/chat', room.kind === 'channel' ? 'channels' : 'direkt', room.id];
  }

  async direct(uid: string): Promise<void> {
    const id = await this.store.direct(uid);
    await this.router.navigate(['/chat/direkt', id]);
  }

  thread(id: string): void {
    void this.router.navigate([], {
      queryParams: { thread: id },
      queryParamsHandling: 'merge',
      state: { chatThread: true },
      replaceUrl: !!this.threadId(),
    });
  }

  closeThread(): void {
    if ((this.location.getState() as { chatThread?: boolean }).chatThread) this.location.back();
    else
      void this.router.navigate([], {
        queryParams: { thread: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
  }

  message(room: ChatRoom, id: string, root: string): void {
    void this.router.navigate(this.path(room), {
      queryParams: { thread: root || null, message: id },
    });
  }
}
