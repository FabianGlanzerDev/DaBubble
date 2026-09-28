import { Injectable, signal } from '@angular/core';

/** Observed connectivity states; unknown must never be presented as a confirmed online or offline result. */
export type Presence = 'online' | 'offline' | 'unknown';

/** Stores server-observed statuses while distinguishing local disconnection from remote offline users. */
@Injectable({ providedIn: 'root' })
export class PresenceState {
  readonly connected = signal(false);
  readonly users = signal<Record<string, Presence>>({});

  /** Returns unknown whenever this client cannot verify the server's presence information. */
  status(uid: string): Presence {
    return this.connected() ? (this.users()[uid] ?? 'unknown') : 'unknown';
  }

  /** Provides localized status text, including explicit feedback for unavailable presence information. */
  label(uid: string): string {
    return { online: 'Online', offline: 'Offline', unknown: 'Status nicht verfügbar' }[
      this.status(uid)
    ];
  }

  /** Clears cached statuses and connection certainty when the presence client disconnects. */
  reset(): void {
    this.connected.set(false);
    this.users.set({});
  }
}
