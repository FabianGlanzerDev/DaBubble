import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setLogLevel,
} from 'firebase/firestore';

let environment;
const db = (uid, provider) =>
  environment
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: provider, identities: {} },
    })
    .firestore();
const profile = (uid) => ({
  uid,
  name: 'Provider Test',
  avatarId: 2,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Local emulator required');
  setLogLevel('silent');
  environment = await initializeTestEnvironment({
    projectId: 'demo-dabubble-auth',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment?.cleanup());

test('guest profiles are owned, directory data is limited and unauthenticated access stays denied', async () => {
  const guest = db('guest', 'anonymous');
  const alice = db('alice', 'password');
  const visitor = environment.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(guest, 'users/guest'), profile('guest')));
  await assertSucceeds(setDoc(doc(alice, 'users/alice'), profile('alice')));
  await assertSucceeds(
    updateDoc(doc(guest, 'users/guest'), {
      name: 'Edited guest',
      avatarId: 5,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    setDoc(doc(guest, 'directory/guest'), {
      uid: 'guest',
      name: 'Edited guest',
      avatarId: 5,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(getDocs(collection(guest, 'directory')));
  await assertSucceeds(getDoc(doc(alice, 'directory/guest')));
  await assertFails(getDoc(doc(guest, 'users/alice')));
  await assertFails(getDoc(doc(alice, 'users/guest')));
  await assertFails(getDocs(collection(guest, 'users')));
  await assertFails(setDoc(doc(guest, 'users/alice'), profile('alice')));
  await assertFails(deleteDoc(doc(guest, 'users/guest')));
  await assertFails(updateDoc(doc(guest, 'directory/guest'), { email: 'private@example.test' }));
  await assertFails(setDoc(doc(guest, 'directory/alice'), { uid: 'alice' }));
  for (const path of ['users/guest', 'directory/guest']) {
    await assertFails(getDoc(doc(visitor, path)));
    await assertFails(deleteDoc(doc(visitor, path)));
    await assertFails(setDoc(doc(visitor, path), profile('guest')));
  }
  await assertFails(getDocs(collection(visitor, 'directory')));
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'accountDeletions/guest'), { state: 'running' });
  });
  await assertFails(getDoc(doc(guest, 'users/guest')));
  await assertFails(getDocs(collection(guest, 'directory')));
  await assertFails(
    updateDoc(doc(guest, 'users/guest'), { name: 'Bypass', updatedAt: serverTimestamp() }),
  );
});

test('Google and password users retain own profile rights and cannot edit each other', async () => {
  for (const [uid, provider] of [
    ['alice', 'google.com'],
    ['bob', 'password'],
  ]) {
    const client = db(uid, provider);
    await assertSucceeds(setDoc(doc(client, 'users', uid), profile(uid)));
    await assertSucceeds(getDoc(doc(client, 'users', uid)));
    await assertSucceeds(
      updateDoc(doc(client, 'users', uid), { name: 'Updated', updatedAt: serverTimestamp() }),
    );
    await assertFails(getDoc(doc(client, 'users', uid === 'alice' ? 'bob' : 'alice')));
    await assertFails(
      setDoc(doc(client, 'users', uid === 'alice' ? 'bob' : 'alice'), profile(uid)),
    );
  }
});
