import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { validateTarget } from '../../scripts/account-deletion/environment.mts';
import { inventory } from '../../scripts/account-deletion/inventory.mts';
import { deleteAccount, purgeCompleted } from '../../scripts/account-deletion/worker.mts';
import {
  context,
  db,
  rules,
  password,
  stamp,
  message,
  reaction,
  room,
  start,
  stop,
  reset,
  seed,
  confirm,
} from './fixture.mjs';

before(start);
after(stop);
beforeEach(reset);
const path = (id, suffix) => db.doc('conversations/' + id + '/' + suffix);
const missing = async (reference) => assert.equal((await reference.get()).exists, false);

test('preview is read-only; missing confirmation, wrong project and stale review are rejected', async () => {
  await seed();
  await path('team', 'messages/own').set(message('alice', 'Private content'));
  const plan = await inventory(context, 'alice');
  assert.equal(plan.summary.ownMessages, 1);
  assert.equal((await context.auth.getUser('alice')).disabled, false);
  await missing(db.doc('accountDeletions/alice'));
  await assert.rejects(
    deleteAccount(context, 'alice', { uid: 'bob', fingerprint: plan.fingerprint }),
  );
  await path('team', 'messages/new').set(message('alice', 'After preview'));
  await assert.rejects(
    deleteAccount(context, 'alice', { uid: 'alice', fingerprint: plan.fingerprint }),
    /Neue Vorschau/,
  );
  assert.throws(() => validateTarget('YOUR_FIREBASE_PROJECT_ID', true));
  assert.throws(() => validateTarget('another-project', false));
  assert.throws(() => validateTarget('YOUR_FIREBASE_PROJECT_ID', false)); // emulator env cannot target Cloud
  await missing(db.doc('accountDeletions/alice'));
});

test('complete cleanup preserves other authors and thread structure, removes even former memberships and orphan data', async () => {
  await seed();
  const originalBob = message('bob', 'alice is quoted here');
  for (const [id, data] of Object.entries({
    root: message('alice', 'Original'),
    answer: message('bob', 'Keep my reply', 'root'),
    standalone: message('alice', 'Remove'),
    bob: originalBob,
    ownReply: message('alice', 'Remove reply', 'bob'),
    soft: { ...message('alice', ''), deleted: true },
  }))
    await path('team', 'messages/' + id).set(data);
  await path('team', 'reactions/root_bob').set(reaction('bob', 'root'));
  await path('team', 'reactions/bob_alice').set(reaction('alice', 'bob'));
  await path('team', 'reactions/bob_bob').set(reaction('bob', 'bob'));
  await seed('left', { ...room('channel', ['bob'], 'bob'), name: 'Left', nameKey: 'left' });
  await path('left', 'messages/old').set(message('alice', 'Former member'));
  await seed('empty', { ...room('channel', ['alice']), name: 'Empty', nameKey: 'empty' });
  await path('empty', 'messages/own').set(message('alice', 'Only my data'));
  await path('orphan', 'messages/own').set(message('alice', 'Missing room document'));
  await db.doc('users/alice/private/extra').set({ note: 'Nested profile data' });

  const result = await confirm();
  assert.equal(result.state, 'complete');
  for (const suffix of ['standalone', 'ownReply', 'soft'])
    await missing(path('team', 'messages/' + suffix));
  const placeholder = (await path('team', 'messages/root').get()).data();
  assert.deepEqual(placeholder, { ...message('', ''), deleted: true });
  assert.deepEqual((await path('team', 'messages/bob').get()).data(), originalBob);
  assert.equal((await path('team', 'messages/answer').get()).get('rootId'), 'root');
  await missing(path('team', 'reactions/root_bob'));
  await missing(path('team', 'reactions/bob_alice'));
  assert.equal((await path('team', 'reactions/bob_bob').get()).exists, true);
  assert.deepEqual((await db.doc('conversations/team').get()).get('memberIds'), ['bob']);
  assert.equal((await db.doc('conversations/team').get()).get('createdBy'), '');
  for (const name of [
    'users/alice',
    'directory/alice',
    'users/alice/private/extra',
    'channelNames/empty',
    'conversations/empty',
  ])
    await missing(db.doc(name));
  await missing(path('left', 'messages/old'));
  await missing(path('orphan', 'messages/own'));
  await assert.rejects(context.auth.getUser('alice'), { code: 'auth/user-not-found' });
  assert.equal((await context.auth.getUser('bob')).disabled, false);
  assert.equal((await db.doc('users/bob').get()).exists, true);
  assert.deepEqual(Object.keys((await db.doc('accountDeletions/alice').get()).data()).sort(), [
    'purgeAfter',
    'state',
  ]);
});

test('direct transcripts migrate without deleted UID; own self-chat disappears; archives remain private and read-only', async () => {
  await seed('dm_alice~bob', room('direct'));
  await path('dm_alice~bob', 'messages/root').set(message('alice', 'Remove me'));
  await path('dm_alice~bob', 'messages/answer').set(message('bob', 'Keep answer', 'root'));
  await path('dm_alice~bob', 'reactions/answer_bob').set(reaction('bob', 'answer'));
  await seed('dm_alice', room('direct', ['alice']));
  await path('dm_alice', 'messages/only').set(message('alice', 'Self'));
  await confirm();
  await missing(db.doc('conversations/dm_alice~bob'));
  assert.equal((await db.collection('conversations/dm_alice~bob/messages').get()).empty, true);
  await missing(db.doc('conversations/dm_alice'));
  const archives = await db.collection('conversations').get();
  assert.equal(archives.size, 1);
  const archive = archives.docs[0];
  assert.match(archive.id, /^archive_/);
  assert.equal(JSON.stringify(archive.data()).includes('alice'), false);
  assert.equal((await archive.ref.collection('messages').get()).size, 2);
  const bob = rules.authenticatedContext('bob').firestore();
  const eve = rules.authenticatedContext('eve').firestore();
  await assertSucceeds(getDoc(doc(bob, archive.ref.path)));
  await assertFails(getDoc(doc(eve, archive.ref.path)));
  await assertFails(
    setDoc(doc(bob, archive.ref.path + '/messages/new'), {
      ...message('bob', 'Blocked'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(bob, archive.ref.path + '/messages/answer'), {
      text: 'Edit',
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(bob, archive.ref.path + '/reactions/answer_bob')));
});

test('stale sessions cannot recreate a profile, send messages, invite a deleting user or manipulate job locks', async () => {
  await seed();
  await db.doc('accountDeletions/alice').set({ state: 'running' });
  const alice = rules.authenticatedContext('alice').firestore(),
    bob = rules.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(alice, 'users/alice')));
  await assertFails(getDoc(doc(alice, 'conversations/team')));
  await assertFails(
    setDoc(doc(alice, 'conversations/team/messages/new'), {
      ...message('alice', 'No'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(alice, 'accountDeletions/alice')));
  await assertFails(setDoc(doc(bob, 'deletionLocks/team'), { uid: 'alice' }));
  await assertFails(getDoc(doc(bob, 'accountDeletions/alice')));
  await seed('other', { ...room('channel', ['bob'], 'bob'), name: 'Other', nameKey: 'other' });
  await assertFails(
    updateDoc(doc(bob, 'conversations/other'), {
      memberIds: ['bob', 'alice'],
      updatedAt: serverTimestamp(),
    }),
  );
  await db.doc('deletionLocks/team').set({ uid: 'alice', archiveId: 'unused' });
  await assertSucceeds(getDoc(doc(bob, 'conversations/team')));
  await assertFails(
    updateDoc(doc(bob, 'conversations/team'), {
      description: 'Concurrent change',
      updatedAt: serverTimestamp(),
    }),
  );
});

test('an interrupted large direct migration resumes without losing or duplicating foreign messages', async () => {
  await seed('dm_alice~bob', room('direct'));
  await path('dm_alice~bob', 'messages/own').set(message('alice', 'Remove'));
  for (let start = 0; start < 701; start += 350) {
    const batch = db.batch();
    for (let i = start; i < Math.min(701, start + 350); i++)
      batch.set(path('dm_alice~bob', 'messages/bob' + i), message('bob', 'Keep ' + i));
    await batch.commit();
  }
  const original = db.batch.bind(db);
  let count = 0;
  db.batch = () => {
    const batch = original(),
      commit = batch.commit.bind(batch);
    batch.commit = async () => {
      const result = await commit();
      if (++count === 4) throw Error('Simulated lost response after committed source deletion');
      return result;
    };
    return batch;
  };
  try {
    await assert.rejects(confirm(), /Simulated/);
  } finally {
    db.batch = original;
  }
  assert.equal((await db.doc('accountDeletions/alice').get()).get('state'), 'failed');
  assert.equal((await context.auth.getUser('alice')).disabled, true);
  await confirm();
  const archives = await db.collection('conversations').get();
  assert.equal(archives.size, 1);
  assert.equal((await archives.docs[0].ref.collection('messages').get()).size, 701);
  assert.equal((await db.collection('deletionLocks').get()).empty, true);
});

test('Auth deletion failure is visible and retryable; completed runs are idempotent', async () => {
  await seed();
  const original = context.auth.deleteUser.bind(context.auth);
  context.auth.deleteUser = async () => {
    throw Error('Simulated Auth outage');
  };
  try {
    await assert.rejects(confirm(), /Auth outage/);
  } finally {
    context.auth.deleteUser = original;
  }
  assert.equal((await db.doc('accountDeletions/alice').get()).get('state'), 'failed');
  await confirm();
  await confirm();
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-emulator-key',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.test', password, returnSecureToken: true }),
    },
  );
  assert.equal(response.ok, false);
  assert.equal((await context.auth.getUser('bob')).disabled, false);
});

test('security marker cannot be removed early; expired completed markers are explicitly purged', async () => {
  await confirm();
  assert.equal(await purgeCompleted(context), 0);
  await db.doc('accountDeletions/alice').update({ purgeAfter: Timestamp.fromMillis(0) });
  assert.equal(await purgeCompleted(context), 1);
  await missing(db.doc('accountDeletions/alice'));
});

test('a concurrent deletion run is rejected without stealing its lease', async () => {
  await db.doc('accountDeletions/alice').set({
    state: 'running',
    owner: 'another-process',
    leaseUntil: Timestamp.fromMillis(Date.now() + 60000),
  });
  await assert.rejects(confirm(), /läuft bereits/);
  assert.equal((await db.doc('accountDeletions/alice').get()).get('owner'), 'another-process');
  assert.equal((await context.auth.getUser('alice')).disabled, false);
});

test('foreign data in memberless channels survives; deleting the last archive member removes obsolete placeholders', async () => {
  await seed('alone', { ...room('channel', ['alice']), name: 'Alone', nameKey: 'alone' });
  await path('alone', 'messages/bob').set(message('bob', 'Former member content'));
  await seed('dm_alice~bob', room('direct'));
  await path('dm_alice~bob', 'messages/root').set(message('alice', 'Remove'));
  await path('dm_alice~bob', 'messages/reply').set(message('bob', 'Reply', 'root'));
  await confirm('alice');
  assert.deepEqual((await db.doc('conversations/alone').get()).get('memberIds'), []);
  assert.equal((await path('alone', 'messages/bob').get()).get('text'), 'Former member content');
  await confirm('bob');
  assert.equal((await db.collection('conversations').get()).empty, true);
  assert.equal((await db.collectionGroup('messages').get()).empty, true);
  assert.equal((await db.collection('channelNames').get()).empty, true);
});
