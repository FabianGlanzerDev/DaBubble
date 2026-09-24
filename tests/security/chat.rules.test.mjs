import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  setLogLevel,
} from 'firebase/firestore';

let environment;
const db = (uid = 'alice') =>
  uid
    ? environment.authenticatedContext(uid).firestore()
    : environment.unauthenticatedContext().firestore();
const stamp = () => ({ updatedAt: serverTimestamp() });
const message = (authorId = 'alice', changes = {}) => ({
  authorId,
  text: 'Hallo',
  rootId: '',
  deleted: false,
  createdAt: serverTimestamp(),
  ...stamp(),
  ...changes,
});
const room = (changes = {}) => ({
  kind: 'channel',
  name: 'Team',
  nameKey: 'team',
  description: '',
  memberIds: ['alice'],
  createdBy: 'alice',
  createdAt: serverTimestamp(),
  ...stamp(),
  ...changes,
});
const ref = (database, path = 'messages/first', id = 'team') =>
  doc(database, 'conversations', id, ...path.split('/'));
const reaction = (userId = 'alice', changes = {}) => ({
  userId,
  messageId: 'first',
  emojis: ['✅'],
  ...stamp(),
  ...changes,
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
after(async () => environment?.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  for (const uid of ['alice', 'bob', 'eve']) {
    await setDoc(doc(db(uid), 'users', uid), {
      uid,
      name: uid,
      avatarId: 0,
      createdAt: serverTimestamp(),
      ...stamp(),
    });
    await setDoc(doc(db(uid), 'directory', uid), { uid, name: uid, avatarId: 0, ...stamp() });
  }
});

function create(database = db(), id = 'team', changes = {}) {
  const data = room(changes),
    batch = writeBatch(database);
  batch.set(doc(database, 'channelNames', data.nameKey), { roomId: id });
  batch.set(doc(database, 'conversations', id), data);
  return batch.commit();
}

async function shared() {
  await create();
  await updateDoc(doc(db(), 'conversations/team'), { memberIds: ['alice', 'bob'], ...stamp() });
  await setDoc(ref(db()), message());
}

test('directory is authenticated-readable, excludes private fields and disallows impersonation', async () => {
  await assertSucceeds(getDocs(collection(db('bob'), 'directory')));
  await assertFails(getDocs(collection(db(null), 'directory')));
  await assertFails(getDoc(doc(db('bob'), 'users/alice')));
  await assertFails(updateDoc(doc(db('bob'), 'directory/alice'), { name: 'bob', ...stamp() }));
  await assertFails(
    updateDoc(doc(db(), 'directory/alice'), { email: 'private@example.test', ...stamp() }),
  );
  await assertFails(updateDoc(doc(db(), 'directory/alice'), { name: 'forged', ...stamp() }));
});

test('channel creation requires atomic unique name reservation and valid schema', async () => {
  await assertSucceeds(create());
  await assertFails(create(db('bob'), 'other', { createdBy: 'bob', memberIds: ['bob'] }));
  await assertFails(
    setDoc(doc(db(), 'conversations/no-reservation'), room({ name: 'Other', nameKey: 'other' })),
  );
  await assertFails(setDoc(doc(db(), 'channelNames/orphan'), { roomId: 'missing' }));
  await assertFails(create(db(), 'spoof', { name: 'Spoof', nameKey: 'spoof', createdBy: 'bob' }));
  await assertFails(create(db(), 'extra', { name: 'Extra', nameKey: 'extra', admin: true }));
  await assertFails(create(db(), 'bad', { name: ' Team ', nameKey: ' team ' }));
  await assertFails(create(db(null), 'anonymous', { name: 'Anonymous', nameKey: 'anonymous' }));
});

test('channel list must be constrained to membership; outsiders cannot read or join', async () => {
  await create();
  await assertSucceeds(
    getDocs(
      query(collection(db(), 'conversations'), where('memberIds', 'array-contains', 'alice')),
    ),
  );
  await assertFails(getDocs(collection(db(), 'conversations')));
  await assertFails(getDoc(doc(db('bob'), 'conversations/team')));
  await assertFails(
    updateDoc(doc(db('bob'), 'conversations/team'), { memberIds: ['alice', 'bob'], ...stamp() }),
  );
  await assertFails(getDoc(doc(db(null), 'conversations/team')));
});

test('every member can invite registered users, but cannot remove others or change creator', async () => {
  await shared();
  const target = doc(db('bob'), 'conversations/team');
  await assertSucceeds(updateDoc(target, { memberIds: ['alice', 'bob', 'eve'], ...stamp() }));
  await assertFails(updateDoc(target, { memberIds: ['bob', 'eve'], ...stamp() }));
  await assertFails(
    updateDoc(target, { memberIds: ['alice', 'bob', 'eve', 'unknown'], ...stamp() }),
  );
  await assertFails(updateDoc(target, { memberIds: ['alice', 'bob', 'eve', 'eve'], ...stamp() }));
  await assertFails(updateDoc(target, { createdBy: 'bob', ...stamp() }));
  await assertFails(deleteDoc(target));
});

test('rename by a member atomically frees old name, rejects collisions and stranded reservations', async () => {
  await shared();
  const database = db('bob'),
    batch = writeBatch(database);
  batch.delete(doc(database, 'channelNames/team'));
  batch.set(doc(database, 'channelNames/new'), { roomId: 'team' });
  batch.update(doc(database, 'conversations/team'), {
    name: 'New',
    nameKey: 'new',
    description: 'New description',
    ...stamp(),
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(create(db(), 'second'));
  await assertFails(
    updateDoc(doc(database, 'conversations/team'), { name: 'Team', nameKey: 'team', ...stamp() }),
  );
  await assertFails(deleteDoc(doc(database, 'channelNames/new')));
  await assertFails(
    updateDoc(doc(db('eve'), 'conversations/team'), { description: 'hijack', ...stamp() }),
  );
});

test('leaving revokes all room reads and writes, including reactions and threads', async () => {
  await shared();
  const bob = db('bob');
  await assertSucceeds(
    updateDoc(doc(bob, 'conversations/team'), { memberIds: ['alice'], ...stamp() }),
  );
  await assertFails(getDoc(ref(bob)));
  await assertFails(getDocs(collection(bob, 'conversations/team/messages')));
  await assertFails(setDoc(ref(bob, 'messages/reply'), message('bob', { rootId: 'first' })));
  await assertFails(setDoc(ref(bob, 'reactions/first_bob'), reaction('bob')));
  await assertSucceeds(updateDoc(doc(db(), 'conversations/team'), { memberIds: [], ...stamp() }));
  await assertFails(getDoc(doc(db(), 'conversations/team')));
});

test('members can send and edit their messages, but never impersonate or alter other messages', async () => {
  await shared();
  await assertSucceeds(setDoc(ref(db('bob'), 'messages/bob'), message('bob')));
  await assertSucceeds(updateDoc(ref(db()), { text: 'Edited', ...stamp() }));
  await assertFails(updateDoc(ref(db('bob')), { text: 'Hijacked', ...stamp() }));
  await assertFails(setDoc(ref(db('bob'), 'messages/forged'), message('alice')));
  await assertFails(updateDoc(ref(db()), { authorId: 'bob', ...stamp() }));
  await assertFails(updateDoc(ref(db()), { rootId: 'another', ...stamp() }));
  await assertFails(setDoc(ref(db('eve'), 'messages/outsider'), message('eve')));
  await assertFails(setDoc(ref(db(null), 'messages/guest'), message('guest')));
});

test('message schema rejects whitespace, excessive length, unexpected properties and forged timestamps', async () => {
  await create();
  for (const changes of [
    { text: ' \n ' },
    { text: 'x'.repeat(4001) },
    { attachment: 'evil' },
    { createdAt: new Date(0) },
    { updatedAt: new Date(0) },
    { deleted: true },
  ])
    await assertFails(setDoc(ref(db()), message('alice', changes)));
  await assertSucceeds(setDoc(ref(db()), message('alice', { text: 'line 1\nline 2 ✅' })));
});

test('soft deletion clears text irreversibly while keeping replies; hard deletion denied', async () => {
  await shared();
  await assertFails(updateDoc(ref(db('bob')), { text: '', deleted: true, ...stamp() }));
  await assertFails(updateDoc(ref(db()), { deleted: true, ...stamp() }));
  await assertSucceeds(updateDoc(ref(db()), { deleted: true, text: '', ...stamp() }));
  await assertFails(updateDoc(ref(db()), { deleted: false, text: 'Restored', ...stamp() }));
  await assertFails(deleteDoc(ref(db())));
  await assertSucceeds(
    setDoc(ref(db('bob'), 'messages/reply'), message('bob', { rootId: 'first' })),
  );
});

test('thread roots must exist in the same room and must be top-level messages', async () => {
  await shared();
  await assertSucceeds(
    setDoc(ref(db('bob'), 'messages/reply'), message('bob', { rootId: 'first' })),
  );
  await assertFails(setDoc(ref(db(), 'messages/nested'), message('alice', { rootId: 'reply' })));
  await assertFails(setDoc(ref(db(), 'messages/missing'), message('alice', { rootId: 'absent' })));
  await create(db(), 'other', { name: 'Other', nameKey: 'other' });
  await assertFails(
    setDoc(ref(db(), 'messages/cross', 'other'), message('alice', { rootId: 'first' })),
  );
});

test('direct conversations are canonical and readable only by participants', async () => {
  const direct = room({ kind: 'direct', name: '', nameKey: '', memberIds: ['alice', 'bob'] });
  await assertSucceeds(getDoc(doc(db(), 'conversations/dm_alice~bob')));
  await assertSucceeds(setDoc(doc(db(), 'conversations/dm_alice~bob'), direct));
  await assertSucceeds(getDoc(doc(db('bob'), 'conversations/dm_alice~bob')));
  await assertFails(getDoc(doc(db('eve'), 'conversations/dm_alice~bob')));
  await assertFails(
    updateDoc(doc(db(), 'conversations/dm_alice~bob'), {
      memberIds: ['alice', 'bob', 'eve'],
      ...stamp(),
    }),
  );
  await assertFails(
    setDoc(doc(db(), 'conversations/dm_bob~alice'), { ...direct, memberIds: ['bob', 'alice'] }),
  );
  await assertFails(
    setDoc(doc(db(), 'conversations/dm_alice~unknown'), {
      ...direct,
      memberIds: ['alice', 'unknown'],
    }),
  );
  await assertSucceeds(
    setDoc(doc(db(), 'conversations/dm_alice'), { ...direct, memberIds: ['alice'] }),
  );
  await assertSucceeds(setDoc(ref(db(), 'messages/first', 'dm_alice~bob'), message()));
  await assertSucceeds(
    setDoc(ref(db('bob'), 'messages/reply', 'dm_alice~bob'), message('bob', { rootId: 'first' })),
  );
  await assertFails(getDoc(ref(db('eve'), 'messages/first', 'dm_alice~bob')));
});

test('reactions are per member, toggleable, validated and cannot manipulate someone else', async () => {
  await shared();
  await assertSucceeds(setDoc(ref(db(), 'reactions/first_alice'), reaction()));
  await assertSucceeds(
    setDoc(ref(db('bob'), 'reactions/first_bob'), reaction('bob', { emojis: ['✅', '🙌'] })),
  );
  await assertFails(updateDoc(ref(db('bob'), 'reactions/first_alice'), reaction('bob')));
  await assertFails(deleteDoc(ref(db('bob'), 'reactions/first_alice')));
  await assertFails(setDoc(ref(db('eve'), 'reactions/first_eve'), reaction('eve')));
  await assertFails(
    setDoc(ref(db(), 'reactions/first_alice'), reaction('alice', { emojis: ['not-an-emoji'] })),
  );
  await assertFails(
    setDoc(ref(db(), 'reactions/first_alice'), reaction('alice', { emojis: ['✅', '✅'] })),
  );
  await assertFails(setDoc(ref(db(), 'reactions/first_alice'), reaction('alice', { emojis: [] })));
  await assertFails(
    setDoc(ref(db(), 'reactions/missing_alice'), reaction('alice', { messageId: 'missing' })),
  );
  await assertSucceeds(deleteDoc(ref(db(), 'reactions/first_alice')));
  await updateDoc(ref(db()), { deleted: true, text: '', ...stamp() });
  await assertFails(setDoc(ref(db(), 'reactions/first_alice'), reaction()));
});
