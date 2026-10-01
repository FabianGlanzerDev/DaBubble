import { FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';
import type { DocumentData } from 'firebase-admin/firestore';
import { deleteApp } from 'firebase-admin/app';
import { connectDeletion, requireFirestoreRules } from './account-deletion/environment.mts';
import { demoProfiles, demoChannels, demoMessages } from './demo-data.mts';

/** Fixed document paths and expected seed content used for a non-destructive, idempotent import. */
type SeedDocument = { path: string; data: DocumentData };

const { values: options } = parseArgs({
  strict: true,
  options: {
    project: { type: 'string' },
    emulator: { type: 'boolean' },
    cloud: { type: 'boolean' },
    apply: { type: 'boolean' },
  },
});

/** Builds fictional directory entries and public room metadata without granting private memberships. */
function roomDocuments(): SeedDocument[] {
  return demoChannels.flatMap((channel) => [
    {
      path: 'conversations/' + channel.id,
      data: channelData(channel),
    },
    { path: 'channelNames/' + channel.name, data: { roomId: channel.id } },
  ]);
}

/** Marks only the fixed seed channels as publicly readable without assigning real members. */
function channelData(channel: (typeof demoChannels)[number]): DocumentData {
  return {
    kind: 'channel',
    name: channel.name,
    nameKey: channel.name,
    description: channel.description,
    publicDemo: true,
    memberIds: [],
    createdBy: 'demo-mila',
  };
}

/** Lists every seeded path so operators can review the entire write scope before applying it. */
function documents(): SeedDocument[] {
  return [
    ...demoProfiles.map((profile) => ({ path: 'directory/' + profile.uid, data: profile })),
    ...roomDocuments(),
    ...demoMessages.map(({ room, id, ...data }) => ({
      path: `conversations/${room}/messages/${id}`,
      data: { ...data, deleted: false },
    })),
  ];
}

/** Refuses to overwrite existing content, even when a conflicting document uses a reserved demo ID. */
function sameSeed(actual: DocumentData, expected: DocumentData): boolean {
  const keys = Object.keys(actual).filter((key) => !['createdAt', 'updatedAt'].includes(key));
  return (
    keys.length === Object.keys(expected).length &&
    Object.entries(expected).every(
      ([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value),
    )
  );
}

/** Adds server timestamps only to documents whose persisted schema includes them. */
function timestamped(item: SeedDocument): DocumentData {
  if (item.path.startsWith('channelNames/')) return item.data;
  const updatedAt = FieldValue.serverTimestamp();
  return {
    ...item.data,
    updatedAt,
    ...(!item.path.startsWith('directory/') ? { createdAt: updatedAt } : {}),
  };
}

/** Atomically creates missing demo documents after checking all existing paths for conflicts. */
async function applySeed(context: ReturnType<typeof connectDeletion>, items: SeedDocument[]) {
  await context.db.runTransaction(async (transaction) => {
    const refs = items.map((item) => context.db.doc(item.path));
    const snapshots = await transaction.getAll(...refs);
    snapshots.forEach((snapshot, index) => {
      const item = items[index]!;
      if (snapshot.exists && !sameSeed(snapshot.data()!, item.data))
        throw new Error('Existing data differs at ' + item.path + '; nothing was overwritten.');
      if (!snapshot.exists) transaction.create(refs[index]!, timestamped(item));
    });
  });
}

/** Requires an explicit target and writes only after --apply; Cloud mode verifies deployed rules first. */
function seedContext() {
  if (!options.project || !!options.cloud === !!options.emulator)
    throw new Error('Use --project PROJECT with exactly one of --emulator or --cloud.');
  return connectDeletion(options.project, !!options.emulator);
}

/** Prints the exact path scope and writes only when the operator explicitly supplies --apply. */
async function main(): Promise<void> {
  const context = seedContext();
  try {
    const paths = documents().map((item) => item.path);
    console.log(JSON.stringify(paths, null, 2));
    if (options.apply) await writeSeed(context);
  } finally {
    await deleteApp(context.app);
  }
}

/** Checks rule compatibility before applying the bounded seed transaction to the selected environment. */
async function writeSeed(context: ReturnType<typeof connectDeletion>): Promise<void> {
  await requireFirestoreRules(context);
  await applySeed(context, documents());
  console.log('Demo seed complete; existing content and real accounts were preserved.');
}

await main();
