import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { connectPresence, requirePresenceRules } from './presence.mts';

/** Refuses ambiguous project or emulator settings before any privileged client is initialized. */
export function validateTarget(project: string, emulator: boolean): void {
  const auth = process.env['FIREBASE_AUTH_EMULATOR_HOST'];
  const firestore = process.env['FIRESTORE_EMULATOR_HOST'];
  const realtime = process.env['FIREBASE_DATABASE_EMULATOR_HOST'];
  if (emulator) {
    if (
      project !== 'demo-dabubble-auth' ||
      auth !== '127.0.0.1:9099' ||
      firestore !== '127.0.0.1:8080'
    )
      throw new Error('Beide lokalen Emulatoren und demo-dabubble-auth sind erforderlich.');
  } else if (project !== 'YOUR_FIREBASE_PROJECT_ID' || auth || firestore || realtime) {
    throw new Error('Cloud-Ziel oder Emulator-Umgebung nicht eindeutig. Abbruch.');
  }
}

/** Creates isolated Admin SDK clients for the validated target; cloud mode uses local application-default credentials. */
export function connectDeletion(project: string, emulator: boolean) {
  validateTarget(project, emulator);
  const app = initializeApp(
    { projectId: project, ...(emulator ? {} : { credential: applicationDefault() }) },
    randomUUID(),
  );
  return {
    app,
    db: getFirestore(app),
    auth: getAuth(app),
    presence: connectPresence(app, emulator),
    project,
    emulator,
  };
}
/** Explicit project, emulator mode and privileged clients shared by the operator-only deletion workflow. */
export type DeletionContext = ReturnType<typeof connectDeletion>;

/** Read-only check: never publishes rules. No destructive Cloud step with outdated rules. */
export async function requireDeletionRules(context: DeletionContext): Promise<void> {
  if (context.emulator) return;
  await requirePresenceRules(context.presence);
  const source = await readFile('firestore.rules', 'utf8');
  const deployed = await getSecurityRules(context.app).getFirestoreRuleset();
  /** Ignores line-ending and outer-whitespace differences when comparing local and deployed rules. */
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trim();
  if (
    deployed.source.length !== 1 ||
    normalize(deployed.source[0]?.content ?? '') !== normalize(source)
  )
    throw new Error(
      'Die veröffentlichten Regeln entsprechen nicht firestore.rules. Keine Löschung ausgeführt.',
    );
}

/** Rejects empty or path-like identifiers before building deletion document paths. */
export function validateUid(uid: string): void {
  if (!uid || uid.length > 128 || /[/~\s]/u.test(uid) || uid === '.' || uid === '..')
    throw new Error('Ungültige Nutzerkennung.');
}

/** Recognizes only Firebase's missing-user error so unrelated administrative failures remain fatal. */
export function isMissingAuth(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'auth/user-not-found'
  );
}
