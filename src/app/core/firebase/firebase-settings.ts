import type { FirebaseOptions } from 'firebase/app';

/** Validated public web configuration with an explicit switch for the reserved local emulator environment. */
export interface FirebaseSettings {
  firebase: FirebaseOptions;
  emulators: boolean;
}

/** Fetches uncached runtime settings; null disables Firebase and invalid settings fail closed. */
export async function loadFirebaseSettings(): Promise<FirebaseSettings | null> {
  const response = await fetch('/firebase-config.json', {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('firebase/configuration');
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new Error('firebase/configuration');
  if (value['firebase'] === null) return null;
  return validateSettings(value);
}

/** Narrows untrusted JSON to a non-null object before inspecting configuration fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Copies only supported Firebase options and validates emulator and presence endpoints. */
function validateSettings(value: Record<string, unknown>): FirebaseSettings {
  const options = value['firebase'];
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
  if (!isRecord(options) || !hasRequiredStrings(options, required))
    throw new Error('firebase/configuration');
  const firebase = Object.fromEntries(
    required.map((key) => [key, options[key]]),
  ) as FirebaseOptions;
  const emulators = value['emulators'] === true;
  validateEmulatorMode(firebase.projectId!, emulators);
  firebase.databaseURL = presenceUrl(options['databaseURL'], emulators);
  return { firebase, emulators };
}

/** Uses the reserved demo endpoint locally and validates an optional production database origin. */
function presenceUrl(value: unknown, emulators: boolean): string | undefined {
  if (emulators) return 'https://demo-dabubble-auth-default-rtdb.firebaseio.com';
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('firebase/configuration');
  const url = new URL(value);
  if (!validPresenceUrl(url)) throw new Error('firebase/configuration');
  return url.origin;
}

/** Allows only credential-free HTTPS Firebase database origins with no path, query or fragment. */
function validPresenceUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    /\.(firebaseio\.com|firebasedatabase\.app)$/.test(url.hostname) &&
    url.pathname === '/'
  );
}

/** Checks that every required configuration field contains a nonblank string. */
function hasRequiredStrings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string' && !!value[key].trim());
}

/** Restricts emulator use to approved local hosts and rejects demo project IDs in production mode. */
function validateEmulatorMode(projectId: string, emulators: boolean): void {
  const local = ['localhost', '127.0.0.1', 'dabubble.test'].includes(location.hostname);
  if (emulators && (!local || projectId !== 'demo-dabubble-auth'))
    throw new Error('firebase/configuration');
  if (!emulators && projectId.startsWith('demo-')) throw new Error('firebase/configuration');
}
