import { parseArgs } from 'node:util';
import { deleteApp } from 'firebase-admin/app';
import { connectDeletion, validateUid } from './environment.mts';
import { inventory } from './inventory.mts';
import { reviewRoom } from './review.mts';
import { deleteAccount, purgeCompleted } from './worker.mts';
import { presenceInventory } from './presence.mts';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      project: { type: 'string' },
      emulator: { type: 'boolean' },
      cloud: { type: 'boolean' },
      uid: { type: 'string' },
      confirm: { type: 'string' },
      fingerprint: { type: 'string' },
    },
  });
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !['plan', 'execute', 'purge'].includes(command ?? '') ||
    !values.project ||
    !!values.emulator === !!values.cloud
  ) {
    throw new Error(
      'Aufruf: plan|execute|purge --project PROJEKT --emulator|--cloud [--uid UID] [--confirm UID --fingerprint HASH]',
    );
  }
  if (command !== 'purge') validateUid(values.uid ?? '');
  if (command === 'purge' && (values.uid || values.confirm || values.fingerprint))
    throw new Error('purge prüft alle abgeschlossenen Sperrvermerke; keine UID-Filterung möglich.');
  if (command === 'execute' && (!values.confirm || !values.fingerprint))
    throw new Error(
      'Zuerst plan ausführen. execute benötigt --confirm UID und --fingerprint HASH.',
    );
  const context = connectDeletion(values.project, !!values.emulator);
  try {
    if (command === 'purge')
      console.log(JSON.stringify({ removedGuards: await purgeCompleted(context) }));
    else if (command === 'plan') {
      const plan = await inventory(context, values.uid!);
      console.log(
        JSON.stringify(
          {
            ...plan.summary,
            account: plan.account,
            presence: await presenceInventory(context.presence, values.uid!),
            review: plan.rooms.map((room) => reviewRoom(room, values.uid!)),
            fingerprint: plan.fingerprint,
          },
          null,
          2,
        ),
      );
    } else
      console.log(
        JSON.stringify(
          await deleteAccount(context, values.uid!, {
            uid: values.confirm!,
            fingerprint: values.fingerprint!,
          }),
          null,
          2,
        ),
      );
  } finally {
    await deleteApp(context.app);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Kontolöschung fehlgeschlagen.');
  process.exitCode = 1;
});
