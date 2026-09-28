import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { context, start, stop, reset, confirm } from './fixture.mjs';
import { purgeCompleted } from '../../scripts/account-deletion/worker.mts';

before(start);
after(stop);
beforeEach(reset);

test('confirmed deletion removes only own presence and retains the revocation guard until purge', async () => {
  await context.presence.ref('presence').set({
    alice: { connections: { tab1: true, tab2: true } },
    bob: { connections: { other: true } },
  });
  await confirm('alice');
  assert.equal((await context.presence.ref('presence/alice').get()).exists(), false);
  assert.equal((await context.presence.ref('presence/bob/connections/other').get()).val(), true);
  assert.equal((await context.presence.ref('presenceBlocks/alice').get()).val(), true);
  assert.equal(await purgeCompleted(context), 0);
  assert.equal((await context.presence.ref('presenceBlocks/alice').get()).val(), true);
  await context.db.doc('accountDeletions/alice').update({ purgeAfter: Timestamp.fromMillis(0) });
  assert.equal(await purgeCompleted(context), 1);
  assert.equal((await context.presence.ref('presenceBlocks/alice').get()).exists(), false);
  assert.equal((await context.presence.ref('presence/bob/connections/other').get()).val(), true);
});
