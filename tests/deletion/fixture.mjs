import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { connectDeletion } from '../../scripts/account-deletion/environment.mts';
import { inventory } from '../../scripts/account-deletion/inventory.mts';
import { deleteAccount } from '../../scripts/account-deletion/worker.mts';

export const context = connectDeletion('demo-dabubble-auth', true);
export const db = context.db;
export let rules;
export const password = randomUUID();
export const stamp = Timestamp.fromMillis(1700000000000);
export const message = (authorId, text, rootId = '') => ({
  authorId,
  text,
  rootId,
  deleted: false,
  createdAt: stamp,
  updatedAt: stamp,
});
export const reaction = (userId, messageId) => ({
  userId,
  messageId,
  emojis: ['✅'],
  updatedAt: stamp,
});
export const room = (kind = 'channel', memberIds = ['alice', 'bob'], createdBy = 'alice') => ({
  kind,
  memberIds,
  createdBy,
  name: kind === 'channel' ? 'Team' : '',
  nameKey: kind === 'channel' ? 'team' : '',
  description: '',
  createdAt: stamp,
  updatedAt: stamp,
});

export async function start() {
  rules = await initializeTestEnvironment({
    projectId: 'demo-dabubble-auth',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
}
export async function stop() {
  await rules?.cleanup();
  await deleteApp(context.app);
}
export async function reset() {
  await rules.clearFirestore();
  await context.presence.ref().set(null);
  // This endpoint and project are guarded by connectDeletion before any test setup.
  const response = await fetch(
    'http://127.0.0.1:9099/emulator/v1/projects/demo-dabubble-auth/accounts',
    { method: 'DELETE' },
  );
  if (!response.ok) throw Error('Auth emulator reset failed');
  for (const uid of ['alice', 'bob', 'eve']) {
    await context.auth.createUser({ uid, email: uid + '@example.test', password });
    await db
      .doc('users/' + uid)
      .set({ uid, name: uid, avatarId: 0, createdAt: stamp, updatedAt: stamp });
    await db.doc('directory/' + uid).set({ uid, name: uid, avatarId: 0, updatedAt: stamp });
  }
}
export async function seed(id = 'team', data = room()) {
  await db.doc('conversations/' + id).set(data);
  if (data.kind === 'channel') await db.doc('channelNames/' + data.nameKey).set({ roomId: id });
}
export async function confirm(uid = 'alice') {
  const plan = await inventory(context, uid);
  return deleteAccount(context, uid, { uid, fingerprint: plan.fingerprint });
}
