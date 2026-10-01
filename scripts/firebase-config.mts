import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** Reads local web settings without importing service credentials or the process environment. */
export function readWebConfig() {
  const values = parseEnv(readFileSync('.env', 'utf8'));
  const fields = {
    apiKey: 'API_KEY',
    authDomain: 'AUTH_DOMAIN',
    projectId: 'PROJECT_ID',
    appId: 'APP_ID',
    databaseURL: 'DATABASE_URL',
  };
  const firebase = Object.fromEntries(
    Object.entries(fields).map(([key, variable]) => [key, requiredValue(values, variable)]),
  ) as Record<keyof typeof fields, string>;
  return { firebase, emulators: false };
}

/** Rejects missing values and example placeholders instead of generating an unusable deployment. */
function requiredValue(values: Record<string, string | undefined>, key: string): string {
  const variable = 'FIREBASE_' + key;
  const value = values[variable]?.trim();
  if (!value || value.includes('YOUR_') || /[<>\r\n]/.test(value))
    throw new Error(`Set ${variable} in the ignored local .env before starting or building.`);
  return value;
}
