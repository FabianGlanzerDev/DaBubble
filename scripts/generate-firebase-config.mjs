import { mkdirSync, writeFileSync } from 'node:fs';
import { readWebConfig } from './firebase-config.mts';

const emulator = process.argv.includes('--emulator');
const config = emulator ? emulatorConfig() : readWebConfig();
if (!emulator && config.firebase.projectId.startsWith('demo-'))
  throw new Error('The FTP configuration must use your actual Firebase project.');
mkdirSync('.generated', { recursive: true });
writeFileSync('.generated/firebase-config.json', JSON.stringify(config, null, 2) + '\n');
console.log(
  emulator
    ? 'Generated localhost-only emulator configuration.'
    : 'Generated public Firebase web settings from the ignored local .env.',
);

/** Uses explicitly non-production identifiers accepted only by the localhost runtime guard. */
function emulatorConfig() {
  return {
    firebase: {
      apiKey: 'demo-emulator-key',
      authDomain: 'localhost',
      projectId: 'demo-dabubble-auth',
      appId: 'demo-dabubble-auth',
      databaseURL: 'https://demo-dabubble-auth-default-rtdb.firebaseio.com',
    },
    emulators: true,
  };
}
