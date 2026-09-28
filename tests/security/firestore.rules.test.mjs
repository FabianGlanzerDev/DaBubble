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
  deleteField,
  serverTimestamp,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';

const projectId = 'demo-dabubble-auth'; // Emulator-only project, never a cloud identifier.
let environment;
const profile = (uid, changes = {}) => ({
  uid,
  name: 'Test Person',
  avatarId: 2,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...changes,
});
const database = (uid) =>
  uid
    ? environment.authenticatedContext(uid).firestore()
    : environment.unauthenticatedContext().firestore();

before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Local emulator required');
  setLogLevel('silent');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment?.cleanup());

test('owner can create, read and update their name and every allowed avatar', async () => {
  const reference = doc(database('alice'), 'users/alice');
  await assertSucceeds(setDoc(reference, profile('alice')));
  await assertSucceeds(getDoc(reference));
  for (let avatarId = 0; avatarId < 6; avatarId++)
    await assertSucceeds(
      updateDoc(reference, { name: 'Alice Neu', avatarId, updatedAt: serverTimestamp() }),
    );
});

test('unauthenticated visitors cannot read, list, create, update or delete profiles', async () => {
  await setDoc(doc(database('alice'), 'users/alice'), profile('alice'));
  const guest = database(null),
    reference = doc(guest, 'users/alice');
  await assertFails(getDoc(reference));
  await assertFails(getDocs(collection(guest, 'users')));
  await assertFails(setDoc(doc(guest, 'users/new'), profile('new')));
  await assertFails(updateDoc(reference, { name: 'Hijacked', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(reference));
});

test('Bob cannot read, create, overwrite, edit or delete Alice; Alice cannot list users', async () => {
  const bob = database('bob'),
    target = doc(bob, 'users/alice');
  await assertFails(setDoc(target, profile('alice')));
  await setDoc(doc(database('alice'), 'users/alice'), profile('alice'));
  await assertFails(getDoc(target));
  await assertFails(setDoc(target, profile('bob')));
  await assertFails(updateDoc(target, { name: 'Bob', avatarId: 3, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(target));
  await assertFails(getDocs(collection(database('alice'), 'users')));
});

const invalid = [
  ['forged uid', { uid: 'bob' }],
  ['empty name', { name: '' }],
  ['whitespace name', { name: '   ' }],
  ['leading spaces', { name: ' Alice' }],
  ['trailing spaces', { name: 'Alice ' }],
  ['long name', { name: 'x'.repeat(81) }],
  ['non-string name', { name: 123 }],
  ['negative avatar', { avatarId: -1 }],
  ['unknown avatar', { avatarId: 6 }],
  ['fractional avatar', { avatarId: 1.5 }],
  ['string avatar', { avatarId: '2' }],
  ['extra role', { role: 'admin' }],
  ['extra email', { email: 'private@example.test' }],
  ['forged creation time', { createdAt: Timestamp.fromMillis(0) }],
  ['forged update time', { updatedAt: Timestamp.fromMillis(0) }],
];
for (const [label, changes] of invalid) {
  test(`profile creation rejects ${label}`, async () => {
    await assertFails(setDoc(doc(database('alice'), 'users/alice'), profile('alice', changes)));
  });
}

test('updates reject privilege escalation, schema removal and immutable field changes', async () => {
  const reference = doc(database('alice'), 'users/alice');
  await setDoc(reference, profile('alice'));
  for (const changes of [
    { role: 'admin' },
    { uid: 'bob' },
    { createdAt: Timestamp.fromMillis(0) },
    { name: deleteField() },
    { avatarId: deleteField() },
    { avatarId: 99 },
    { name: ' ' },
  ])
    await assertFails(updateDoc(reference, { ...changes, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(reference));
});

test('authenticated users cannot write or read messages, channels or nested profile documents', async () => {
  for (const path of ['messages/test', 'channels/test', 'users/alice/private/test']) {
    const reference = doc(database('alice'), path);
    await assertFails(setDoc(reference, { text: 'not implemented' }));
    await assertFails(getDoc(reference));
  }
});
