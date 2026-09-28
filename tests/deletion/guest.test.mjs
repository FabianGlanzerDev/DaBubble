import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  signOut,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  terminate,
  setLogLevel,
} from 'firebase/firestore';
import {
  context,
  db,
  rules,
  start,
  stop,
  reset,
  seed,
  room,
  message,
  reaction,
} from './fixture.mjs';
import { inventory } from '../../scripts/account-deletion/inventory.mts';
import { deleteAccount } from '../../scripts/account-deletion/worker.mts';

before(start);
after(stop);
beforeEach(reset);
const run = promisify(execFile);
const denied = { code: 'permission-denied' };

async function guest() {
  // fixture.connectDeletion has already required BOTH exact local emulator hosts.
  setLogLevel('silent');
  const app = initializeApp(
    { apiKey: 'demo-emulator-key', projectId: 'demo-dabubble-auth' },
    randomUUID(),
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const store = getFirestore(app);
  connectFirestoreEmulator(store, '127.0.0.1', 8080);
  const { user } = await signInAnonymously(auth);
  await setDoc(doc(store, 'users', user.uid), {
    uid: user.uid,
    name: 'Gast Test',
    avatarId: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(store, 'directory', user.uid), {
    uid: user.uid,
    name: 'Gast Test',
    avatarId: 0,
    updatedAt: serverTimestamp(),
  });
  return {
    auth,
    store,
    uid: user.uid,
    close: async () => {
      await terminate(store);
      await deleteApp(app);
    },
  };
}

function changeName(client, uid, name) {
  return updateDoc(doc(client.store, 'users', uid), { name, updatedAt: serverTimestamp() });
}

test('active anonymous profile challenge proves control of the exact UID, not a matching display name', async () => {
  const owner = await guest(),
    attacker = await guest();
  try {
    const challenge = 'Anfrage ' + randomUUID().replaceAll('-', '');
    const before = await db.doc('users/' + owner.uid).get();
    await changeName(owner, owner.uid, challenge);
    const proof = await db.doc('users/' + owner.uid).get();
    assert.equal(proof.get('name'), challenge);
    assert.ok(proof.updateTime.toMillis() > before.updateTime.toMillis());
    assert.equal((await context.auth.getUser(owner.uid)).email, undefined);
    await assert.rejects(changeName(attacker, owner.uid, challenge), denied);
    await assert.rejects(getDoc(doc(attacker.store, 'users', owner.uid)), denied);
    // A copied public name is possible: the operator must NEVER accept another profile/UID.
    await changeName(attacker, attacker.uid, challenge);
    assert.equal((await db.doc('users/' + attacker.uid).get()).get('name'), challenge);
    assert.notEqual(attacker.uid, owner.uid);
    const regular = rules.authenticatedContext('bob').firestore();
    await assert.rejects(
      updateDoc(doc(regular, 'users', owner.uid), {
        name: 'Forged proof',
        updatedAt: serverTimestamp(),
      }),
      denied,
    );
    await changeName(owner, owner.uid, 'Gast Test');
    await signOut(owner.auth);
    assert.equal((await context.auth.getUser(owner.uid)).disabled, false);
    assert.deepEqual((await context.auth.getUser(owner.uid)).providerData, []);
    await assert.rejects(getDoc(doc(owner.store, 'users', owner.uid)), denied);
    await assert.rejects(changeName(owner, owner.uid, challenge), denied);
    const next = await signInAnonymously(owner.auth);
    assert.notEqual(next.user.uid, owner.uid);
    await assert.rejects(changeName(owner, owner.uid, challenge), denied);
    assert.equal((await db.doc('users/' + owner.uid).get()).get('name'), 'Gast Test');
  } finally {
    await owner.close();
    await attacker.close();
  }
});

test('reviewed signed-out guest CLI deletion cleans own persistent data and preserves foreign channel/DM replies privately', async () => {
  const owner = await guest();
  const uid = owner.uid;
  const directId = 'dm_' + [uid, 'bob'].sort().join('~');
  const path = (id, suffix) => db.doc(`conversations/${id}/${suffix}`);
  try {
    await seed('team', room('channel', [uid, 'bob'], uid));
    await seed('left', { ...room('channel', ['bob'], 'bob'), name: 'Left', nameKey: 'left' });
    await seed(directId, room('direct', [uid, 'bob'], uid));
    await seed('dm_' + uid, room('direct', [uid], uid));
    const foreign = message('bob', 'Gast Test is quoted; retain for individual review');
    await path('team', 'messages/guest-root').set(message(uid, 'Remove guest root'));
    await path('team', 'messages/bob-reply').set(
      message('bob', 'Keep channel reply', 'guest-root'),
    );
    await path('team', 'messages/bob-root').set(foreign);
    await path('team', 'messages/guest-reply').set(message(uid, 'Remove guest reply', 'bob-root'));
    await path('team', 'messages/soft').set({ ...message(uid, ''), deleted: true });
    await path('left', 'messages/former').set(message(uid, 'Former guest contribution'));
    await path('team', 'reactions/guest-root_bob').set(reaction('bob', 'guest-root'));
    await path('team', `reactions/bob-root_${uid}`).set(reaction(uid, 'bob-root'));
    await path('team', 'reactions/bob-root_bob').set(reaction('bob', 'bob-root'));
    await path(directId, 'messages/guest-root').set(message(uid, 'Remove private root'));
    await path(directId, 'messages/bob-reply').set(
      message('bob', 'Keep private reply', 'guest-root'),
    );
    await path(directId, 'messages/bob-root').set(message('bob', 'Keep private message'));
    await path(directId, 'messages/guest-reply').set(
      message(uid, 'Remove private reply', 'bob-root'),
    );
    await path(directId, `reactions/bob-root_${uid}`).set(reaction(uid, 'bob-root'));
    await path('dm_' + uid, 'messages/self').set(message(uid, 'Remove self message'));
    await signOut(owner.auth);
    const target = ['--project', 'demo-dabubble-auth', '--emulator', '--uid', uid];
    const cli = async (command, extras = []) =>
      JSON.parse(
        (
          await run(process.execPath, [
            'scripts/account-deletion/cli.mts',
            command,
            ...target,
            ...extras,
          ])
        ).stdout,
      );
    const plan = await cli('plan');
    assert.equal(plan.account.email, null);
    assert.deepEqual(plan.account.providerIds, []);
    assert.equal(plan.database, '(default)');
    assert.equal(plan.project, 'demo-dabubble-auth');
    assert.equal(plan.ownMessages, 7);
    assert.equal(plan.ownReactions, 2);
    assert.equal(plan.foreignMessagesPreserved, 4);
    assert.equal(plan.threadPlaceholders, 2);
    assert.equal(plan.directArchives, 1);
    assert.equal((await db.collection('accountDeletions').get()).empty, true);
    await assert.rejects(cli('execute')); // Admin CLI is gated; this is not identity verification.
    const result = await cli('execute', ['--confirm', uid, '--fingerprint', plan.fingerprint]);
    assert.equal(result.state, 'complete');
    await assert.rejects(context.auth.getUser(uid), { code: 'auth/user-not-found' });
    assert.equal((await context.auth.getUser('bob')).disabled, false);
    const remaining = await cli('plan');
    for (const key of ['accountExists', 'profileExists', 'directoryExists'])
      assert.equal(remaining[key], false);
    assert.equal(remaining.rooms, 0);
    assert.deepEqual(remaining.review, []);
    assert.deepEqual((await db.doc('conversations/team').get()).get('memberIds'), ['bob']);
    assert.equal((await db.doc('conversations/team').get()).get('createdBy'), '');
    assert.deepEqual((await path('team', 'messages/bob-root').get()).data(), foreign);
    assert.equal((await path('team', 'messages/guest-root').get()).get('authorId'), '');
    assert.equal((await path('team', 'messages/guest-root').get()).get('text'), '');
    for (const suffix of [
      'messages/guest-reply',
      'messages/soft',
      'reactions/guest-root_bob',
      `reactions/bob-root_${uid}`,
    ])
      assert.equal((await path('team', suffix).get()).exists, false);
    assert.equal((await path('team', 'reactions/bob-root_bob').get()).exists, true);
    assert.equal((await path('left', 'messages/former').get()).exists, false);
    assert.equal((await db.doc('conversations/' + directId).get()).exists, false);
    assert.equal((await db.doc('conversations/dm_' + uid).get()).exists, false);
    const rooms = await db.collection('conversations').get();
    const archive = rooms.docs.find((item) => item.id.startsWith('archive_'));
    assert.ok(archive);
    assert.deepEqual(archive.get('memberIds'), ['bob']);
    assert.equal(
      (await archive.ref.collection('messages').doc('bob-reply').get()).get('text'),
      'Keep private reply',
    );
    assert.equal(
      (await archive.ref.collection('messages').doc('guest-root').get()).get('authorId'),
      '',
    );
    const bob = rules.authenticatedContext('bob').firestore();
    assert.equal((await getDoc(doc(bob, archive.ref.path))).exists(), true);
    await assert.rejects(
      updateDoc(doc(bob, archive.ref.path + '/messages/bob-root'), { text: 'Rewrite' }),
      denied,
    );
    await signInAnonymously(owner.auth);
    await assert.rejects(getDoc(doc(owner.store, archive.ref.path)), denied);
    await assert.rejects(getDoc(doc(owner.store, 'conversations/team')), denied);
  } finally {
    await owner.close();
  }
});

test('guest conversion invalidates an older deletion review instead of deleting a newly linked account', async () => {
  const owner = await guest();
  try {
    const plan = await inventory(context, owner.uid);
    await linkWithCredential(
      owner.auth.currentUser,
      EmailAuthProvider.credential('converted-' + randomUUID() + '@example.test', randomUUID()),
    );
    await assert.rejects(
      deleteAccount(context, owner.uid, { uid: owner.uid, fingerprint: plan.fingerprint }),
      /Neue Vorschau/,
    );
    assert.equal((await context.auth.getUser(owner.uid)).disabled, false);
    assert.equal((await db.doc('users/' + owner.uid).get()).exists, true);
    assert.equal((await db.doc('accountDeletions/' + owner.uid).get()).exists, false);
    const current = await inventory(context, owner.uid);
    assert.deepEqual(current.account.providerIds, ['password']);
    assert.notEqual(current.fingerprint, plan.fingerprint);
  } finally {
    await owner.close();
  }
});

test('already missing guest Auth identity requires separate review and never silently removes orphan chat data', async () => {
  const owner = await guest();
  try {
    await seed('team', room('channel', [owner.uid, 'bob'], owner.uid));
    const contribution = db.doc('conversations/team/messages/retained');
    await contribution.set(message(owner.uid, 'Do not purge solely from an unverified UID'));
    await signOut(owner.auth);
    await context.auth.deleteUser(owner.uid); // Simulate Auth-only cleanup, exclusively in emulator.
    const plan = await inventory(context, owner.uid);
    assert.equal(plan.summary.accountExists, false);
    assert.equal(plan.summary.ownMessages, 1);
    await assert.rejects(
      deleteAccount(context, owner.uid, { uid: owner.uid, fingerprint: plan.fingerprint }),
      /Konto existiert nicht; kein bestätigter Vorgang/,
    );
    assert.equal((await contribution.get()).exists, true);
    assert.equal((await db.doc('users/' + owner.uid).get()).exists, true);
    assert.equal((await db.doc('accountDeletions/' + owner.uid).get()).exists, false);
  } finally {
    await owner.close();
  }
});
