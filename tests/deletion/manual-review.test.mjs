import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { context, db, start, stop, reset, seed, message, reaction } from './fixture.mjs';
import { inventory } from '../../scripts/account-deletion/inventory.mts';
import { deleteAccount } from '../../scripts/account-deletion/worker.mts';

before(start);
after(stop);
beforeEach(reset);

for (const collection of ['messages', 'reactions']) {
  for (const missingParent of [false, true]) {
    test(`manual review blocks nested ${collection}, missing parent: ${missingParent}`, async () => {
      await seed();
      const plan = await inventory(context, 'alice');
      const parent = db.doc(`conversations/team/${collection}/unexpected`);
      if (!missingParent)
        await parent.set(
          collection === 'messages' ? message('alice', 'Own text') : reaction('alice', 'root'),
        );
      const nested = parent.collection('unexpected-data').doc('foreign');
      await nested.set({ authorId: 'bob', text: 'Do not silently delete another person’s data' });
      await assert.rejects(inventory(context, 'alice'), /Unerwartete Unterkollektion/);
      await assert.rejects(
        deleteAccount(context, 'alice', { uid: 'alice', fingerprint: plan.fingerprint }),
        /Manuelle Prüfung erforderlich/,
      );
      assert.equal((await context.auth.getUser('alice')).disabled, false);
      assert.equal((await context.auth.getUser('bob')).disabled, false);
      assert.equal((await db.doc('users/alice').get()).exists, true);
      assert.equal((await db.doc('directory/alice').get()).exists, true);
      assert.equal((await nested.get()).get('authorId'), 'bob');
      assert.equal((await db.collection('accountDeletions').get()).empty, true);
      assert.equal((await db.collection('deletionLocks').get()).empty, true);
    });
  }
}

test('changed account identity requires a new operator review before deletion', async () => {
  await seed();
  const plan = await inventory(context, 'alice');
  await context.auth.updateUser('alice', { email: 'changed@example.test' });
  await assert.rejects(
    deleteAccount(context, 'alice', { uid: 'alice', fingerprint: plan.fingerprint }),
    /Datenbestand geändert/,
  );
  assert.equal((await context.auth.getUser('alice')).disabled, false);
  assert.equal((await db.collection('accountDeletions').get()).empty, true);
  assert.equal((await inventory(context, 'alice')).account.email, 'changed@example.test');
});
