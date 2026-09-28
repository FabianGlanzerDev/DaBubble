import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { context, db, start, stop, reset, seed, message, reaction } from './fixture.mjs';

before(start);
after(stop);
beforeEach(reset);
const run = promisify(execFile);
const args = ['scripts/account-deletion/cli.mts'];
const target = ['--project', 'demo-dabubble-auth', '--emulator', '--uid', 'alice'];

test('actual command-line preview and confirmed execution clean the emulator account', async () => {
  await seed();
  await db.doc('conversations/team/messages/own').set(message('alice', 'CLI deletion'));
  await db.doc('conversations/team/messages/reply').set(message('bob', 'Private reply', 'own'));
  await db.doc('conversations/team/reactions/own_bob').set(reaction('bob', 'own'));
  const preview = JSON.parse((await run(process.execPath, [...args, 'plan', ...target])).stdout);
  assert.equal(preview.ownMessages, 1);
  assert.equal(preview.account.email, 'alice@example.test');
  assert.deepEqual(preview.account.providerIds, ['password']);
  assert.equal(preview.database, '(default)');
  assert.equal(preview.project, 'demo-dabubble-auth');
  assert.equal(preview.review[0].path, 'conversations/team');
  assert.equal(preview.review[0].foreignMessagesPreserved, 1);
  assert.equal(preview.review[0].foreignReactionsRemoved, 1);
  assert.deepEqual(preview.review[0].placeholderPaths, ['conversations/team/messages/own']);
  assert.equal(JSON.stringify(preview).includes('Private reply'), false);
  assert.equal(JSON.stringify(preview).includes('passwordHash'), false);
  assert.equal((await db.collection('accountDeletions').get()).empty, true);
  await assert.rejects(run(process.execPath, [...args, 'execute', ...target]));
  assert.equal((await context.auth.getUser('alice')).disabled, false);
  const result = JSON.parse(
    (
      await run(process.execPath, [
        ...args,
        'execute',
        ...target,
        '--confirm',
        'alice',
        '--fingerprint',
        preview.fingerprint,
      ])
    ).stdout,
  );
  assert.equal(result.state, 'complete');
  assert.equal(result.remaining.accountExists, false);
  await assert.rejects(context.auth.getUser('alice'), { code: 'auth/user-not-found' });
  assert.equal((await db.doc('conversations/team/messages/own').get()).get('authorId'), '');
  assert.equal(
    (await db.doc('conversations/team/messages/reply').get()).get('text'),
    'Private reply',
  );
  assert.equal((await db.doc('conversations/team/reactions/own_bob').get()).exists, false);
  assert.equal((await context.auth.getUser('bob')).disabled, false);
  const after = JSON.parse((await run(process.execPath, [...args, 'plan', ...target])).stdout);
  assert.equal(after.accountExists, false);
  assert.equal(after.account, null);
  assert.equal(after.profileExists, false);
  assert.equal(after.directoryExists, false);
  assert.equal(after.rooms, 0);
  assert.deepEqual(after.review, []);
});

test('purge rejects a misleading account filter without touching any account', async () => {
  await assert.rejects(run(process.execPath, [...args, 'purge', ...target]), /keine UID-Filterung/);
  assert.equal((await context.auth.getUser('alice')).disabled, false);
  assert.equal((await context.auth.getUser('bob')).disabled, false);
});
