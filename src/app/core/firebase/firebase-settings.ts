import type { FirebaseOptions } from 'firebase/app';

export interface FirebaseSettings {
  firebase: FirebaseOptions;
  emulators: boolean;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
  return { firebase, emulators };
}

function hasRequiredStrings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string' && !!value[key].trim());
}

function validateEmulatorMode(projectId: string, emulators: boolean): void {
  const local = ['localhost', '127.0.0.1', 'dabubble.test'].includes(location.hostname);
  if (emulators && (!local || projectId !== 'demo-dabubble-auth'))
    throw new Error('firebase/configuration');
  if (!emulators && projectId.startsWith('demo-')) throw new Error('firebase/configuration');
}
