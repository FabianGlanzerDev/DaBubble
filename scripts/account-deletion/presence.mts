import { readFileSync } from 'node:fs';
import type { App } from 'firebase-admin/app';
import { getDatabaseWithUrl } from 'firebase-admin/database';
import type { Database } from 'firebase-admin/database';

/** Uses the verified local emulator or the configured database URL for privileged presence maintenance. */
export function connectPresence(app: App, emulator: boolean): Database | null {
  if (emulator) {
    if (process.env['FIREBASE_DATABASE_EMULATOR_HOST'] !== '127.0.0.1:9000')
      throw new Error('Der lokale Realtime-Database-Emulator ist ebenfalls erforderlich.');
    return getDatabaseWithUrl('https://demo-dabubble-auth-default-rtdb.firebaseio.com', app);
  }
  return cloudPresence(app);
}

/** Validates the configured cloud URL without inventing a database or silently targeting an emulator. */
function cloudPresence(app: App): Database | null {
  const config = JSON.parse(readFileSync('public/firebase-config.json', 'utf8'));
  const url: unknown = config.firebase?.databaseURL;
  if (url === undefined || url === null || url === '') return null;
  if (
    typeof url !== 'string' ||
    !/^https:\/\/[^/]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(url)
  )
    throw new Error('Realtime-Database-Ziel nicht eindeutig.');
  return getDatabaseWithUrl(url, app);
}

/** Refuses cloud deletion when deployed Realtime Database rules differ from the local reviewed rules. */
export async function requirePresenceRules(database: Database | null): Promise<void> {
  if (!database) return;
  const deployed = await database.getRulesJSON();
  const expected = JSON.parse(readFileSync('database.rules.json', 'utf8'));
  if (JSON.stringify(deployed) !== JSON.stringify(expected))
    throw new Error('Die Realtime-Database-Regeln entsprechen nicht database.rules.json.');
}

/** Blocks future presence writes for the target UID, removes its active entries and verifies their absence. */
export async function blockPresence(database: Database | null, uid: string): Promise<void> {
  if (!database) return;
  await database.ref('presenceBlocks/' + uid).set(true);
  await database.ref('presence/' + uid).remove();
  if ((await database.ref('presence/' + uid).get()).exists())
    throw new Error('Anwesenheitsdaten verbleiben.');
}

/** Reports only connection count and deletion-block existence for one account, without reading private chat data. */
export async function presenceInventory(database: Database | null, uid: string) {
  if (!database) return { configured: false, connections: 0, blocked: false };
  const connections = await database.ref(`presence/${uid}/connections`).get();
  const blocked = await database.ref('presenceBlocks/' + uid).get();
  return { configured: true, connections: connections.numChildren(), blocked: blocked.exists() };
}
