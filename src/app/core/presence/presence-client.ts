import type { FirebaseApp } from 'firebase/app';
import { onIdTokenChanged, type Auth } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  getDatabase,
  goOffline,
  goOnline,
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
} from 'firebase/database';
import type { Database, DatabaseReference, Unsubscribe } from 'firebase/database';
import type { FirebaseSettings } from '../firebase/firebase-settings';
import { PresenceState } from './presence-state';

function connectionKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/** One server-owned disconnect operation per tab; no heartbeat guesses or last-seen history. */
export class PresenceClient {
  private readonly db: Database | null;
  private readonly connectionId: string;
  private readonly stopIdentity: Unsubscribe;
  private uid = '';
  private revision = 0;
  private connection: DatabaseReference | null = null;
  private stopConnection: Unsubscribe | null = null;
  private readonly readers = new Map<string, Unsubscribe>();
  private wanted: string[] = [];
  private readonly hide = () => this.suspend();
  private readonly show = () => this.resume();

  constructor(
    app: FirebaseApp,
    settings: FirebaseSettings,
    private readonly state: PresenceState,
    auth: Auth,
  ) {
    // Subscribe before RTDB's token listener: cross-tab logout must close the socket
    // before RTDB sends unauth, or the server can reject the onDisconnect removal.
    this.stopIdentity = onIdTokenChanged(auth, (user) => this.identify(user?.uid ?? ''));
    this.db = settings.firebase.databaseURL ? getDatabase(app) : null;
    this.connectionId = this.db ? connectionKey() : '';
    this.configureConnection(settings.emulators);
  }

  private configureConnection(emulated: boolean): void {
    if (!this.db) return;
    if (emulated) connectDatabaseEmulator(this.db, '127.0.0.1', 9000);
    goOffline(this.db);
    window.addEventListener('pagehide', this.hide);
    window.addEventListener('pageshow', this.show);
  }

  identify(uid: string): void {
    if (uid === this.uid) return;
    this.suspend();
    this.uid = uid;
    this.resume();
  }

  watch(uids: string[]): void {
    this.wanted = [...new Set([...uids, this.uid].filter(Boolean))];
    if (!this.db || !this.uid) return;
    for (const [uid, stop] of this.readers) {
      if (!this.wanted.includes(uid)) {
        stop();
        this.readers.delete(uid);
      }
    }
    for (const uid of this.wanted) if (!this.readers.has(uid)) this.read(uid);
  }

  private read(uid: string): void {
    const stop = onValue(
      ref(this.db!, 'presence/' + uid + '/connections'),
      (snapshot) => {
        const status = snapshot.exists() ? 'online' : 'offline';
        this.state.users.update((users) => ({ ...users, [uid]: status }));
      },
      () => this.state.users.update((users) => ({ ...users, [uid]: 'unknown' })),
    );
    this.readers.set(uid, stop);
  }

  private resume(): void {
    if (!this.db || !this.uid || this.stopConnection) return;
    this.connection = ref(this.db, `presence/${this.uid}/connections/${this.connectionId}`);
    this.watch(this.wanted);
    this.stopConnection = onValue(ref(this.db, '.info/connected'), (snapshot) => {
      const revision = ++this.revision;
      this.state.connected.set(false);
      if (snapshot.val() === true) void this.publish(revision, this.connection!);
      else if (this.connection) void remove(this.connection).catch(() => undefined);
    });
    goOnline(this.db);
  }

  private async publish(revision: number, connection: DatabaseReference): Promise<void> {
    try {
      await onDisconnect(connection).remove();
      if (revision !== this.revision) return;
      await set(connection, true);
      if (revision === this.revision) this.state.connected.set(true);
    } catch {
      if (revision === this.revision) this.state.connected.set(false);
    }
  }

  /** Close the socket before auth changes, so the server removes only this tab's connection. */
  suspend(): void {
    this.revision++;
    this.stopConnection?.();
    this.stopConnection = null;
    this.readers.forEach((stop) => stop());
    this.readers.clear();
    this.state.reset();
    if (this.db) goOffline(this.db);
    if (this.connection) void remove(this.connection).catch(() => undefined);
    this.connection = null;
  }

  destroy(): void {
    this.stopIdentity();
    this.suspend();
    window.removeEventListener('pagehide', this.hide);
    window.removeEventListener('pageshow', this.show);
  }
}
