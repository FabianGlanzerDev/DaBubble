import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

let env;
const one = '11111111-1111-1111-1111-111111111111';
const two = '22222222-2222-2222-2222-222222222222';
const path = (uid, id = one) => `presence/${uid}/connections/${id}`;
const client = (uid, provider = 'password') =>
  env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: provider, identities: {} },
    })
    .database();

before(async () => {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000')
    throw new Error('Realtime Database emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-dabubble-auth',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: await readFile('database.rules.json', 'utf8'),
    },
  });
});
beforeEach(async () => env.clearDatabase());
after(async () => env?.cleanup());

for (const provider of ['password', 'anonymous', 'google.com']) {
  test(`${provider}: own connections allowed; foreign writes and private paths denied`, async () => {
    const alice = client('alice', provider);
    const bob = client('bob');
    await assertSucceeds(alice.ref(path('alice')).set(true));
    await assertSucceeds(alice.ref(path('alice', two)).set(true));
    await assertSucceeds(bob.ref('presence/alice/connections').once('value'));
    await assertFails(bob.ref(path('alice')).set(true));
    await assertFails(bob.ref(path('alice')).remove());
    await assertFails(bob.ref('presence/alice').remove());
    await assertFails(bob.ref('users/alice').once('value'));
    await assertFails(bob.ref('conversations/private').once('value'));
    await assertSucceeds(alice.ref(path('alice')).remove());
    await assertSucceeds(alice.ref(path('alice', two)).onDisconnect().remove());
  });
}

test('unauthenticated visitors cannot read status or write a connection', async () => {
  const visitor = env.unauthenticatedContext().database();
  await assertFails(visitor.ref(path('alice')).set(true));
  await assertFails(visitor.ref('presence/alice/connections').once('value'));
});

test('no root enumeration, false status, timestamps, profile data or arbitrary payloads', async () => {
  const alice = client('alice');
  for (const value of [false, 'online', 123, { email: 'private@example.test' }])
    await assertFails(alice.ref(path('alice')).set(value));
  await assertFails(alice.ref('presence/alice/lastSeen').set(Date.now()));
  await assertFails(alice.ref('presence/alice/connections/wrong-key').set(true));
  await assertFails(alice.ref('presence').once('value'));
  await assertFails(alice.ref().once('value'));
});

test('server accepts disconnect removal only for the authenticated owner', async () => {
  const alice = client('alice');
  await assertSucceeds(alice.ref(path('alice')).onDisconnect().remove());
  await assertFails(alice.ref(path('bob')).onDisconnect().remove());
  await assertFails(alice.ref('presence').onDisconnect().remove());
});

test('blocked accounts cannot read presence or recreate it using an old valid token', async () => {
  const alice = client('alice');
  await assertSucceeds(alice.ref(path('alice')).set(true));
  await env.withSecurityRulesDisabled(async (context) => {
    await context.database().ref('presenceBlocks/alice').set(true);
  });
  await assertFails(alice.ref(path('alice', two)).set(true));
  await assertFails(alice.ref('presence/bob/connections').once('value'));
  await assertFails(alice.ref('presenceBlocks/alice').remove());
  await assertFails(alice.ref('presenceBlocks/alice').once('value'));
  await assertSucceeds(alice.ref(path('alice')).remove());
});
