import { Injectable, signal } from '@angular/core';

export type Presence = 'online' | 'offline' | 'unknown';

@Injectable({ providedIn: 'root' })
export class PresenceState {
  readonly connected = signal(false);
  readonly users = signal<Record<string, Presence>>({});

  status(uid: string): Presence {
    return this.connected() ? (this.users()[uid] ?? 'unknown') : 'unknown';
  }

  label(uid: string): string {
    return { online: 'Online', offline: 'Offline', unknown: 'Status nicht verfügbar' }[
      this.status(uid)
    ];
  }

  reset(): void {
    this.connected.set(false);
    this.users.set({});
  }
}
