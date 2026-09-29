import { parseArgs } from 'node:util';
import { deleteApp } from 'firebase-admin/app';
import { connectDeletion, validateUid } from './environment.mts';
import type { DeletionContext } from './environment.mts';
import { inventory } from './inventory.mts';
import { reviewRoom } from './review.mts';
import { deleteAccount, purgeCompleted } from './worker.mts';
import { presenceInventory } from './presence.mts';

const options = {
  project: { type: 'string' },
  emulator: { type: 'boolean' },
  cloud: { type: 'boolean' },
  uid: { type: 'string' },
  confirm: { type: 'string' },
  fingerprint: { type: 'string' },
} as const;
/** Strictly parsed operator arguments; no target or destructive command has an implicit default. */
type Arguments = ReturnType<typeof readArguments>;

/** Accepts exactly one known operation and one explicit environment before validating its UID scope. */
function readArguments() {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options });
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !['plan', 'execute', 'purge'].includes(command ?? '') ||
    !values.project ||
    !!values.emulator === !!values.cloud
  )
    throw new Error(
      'Aufruf: plan|execute|purge --project PROJEKT --emulator|--cloud [--uid UID] [--confirm UID --fingerprint HASH]',
    );
  return { command: command!, values: { ...values, project: values.project } };
}

/** Requires explicit UID confirmation for execution and refuses misleading UID filters on global maintenance. */
function validateOperation({ command, values }: Arguments): void {
  if (command !== 'purge') validateUid(values.uid ?? '');
  if (command === 'purge' && (values.uid || values.confirm || values.fingerprint))
    throw new Error('purge prüft alle abgeschlossenen Sperrvermerke; keine UID-Filterung möglich.');
  if (command === 'execute' && (!values.confirm || !values.fingerprint))
    throw new Error(
      'Zuerst plan ausführen. execute benötigt --confirm UID und --fingerprint HASH.',
    );
}

/** Produces a read-only review containing paths, counts and the confirmation fingerprint. */
async function describePlan(context: DeletionContext, uid: string) {
  const plan = await inventory(context, uid);
  return {
    ...plan.summary,
    account: plan.account,
    presence: await presenceInventory(context.presence, uid),
    review: plan.rooms.map((room) => reviewRoom(room, uid)),
    fingerprint: plan.fingerprint,
  };
}

/** Dispatches only the previously validated operation and returns its report without sensitive contents. */
async function executeOperation(context: DeletionContext, { command, values }: Arguments) {
  if (command === 'purge') return { removedGuards: await purgeCompleted(context) };
  if (command === 'plan') return describePlan(context, values.uid!);
  return deleteAccount(context, values.uid!, {
    uid: values.confirm!,
    fingerprint: values.fingerprint!,
  });
}

/** Releases privileged clients after success or failure without suppressing an incomplete cleanup report. */
async function main(): Promise<void> {
  const args = readArguments();
  validateOperation(args);
  const context = connectDeletion(args.values.project, !!args.values.emulator);
  try {
    console.log(JSON.stringify(await executeOperation(context, args), null, 2));
  } finally {
    await deleteApp(context.app);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Kontolöschung fehlgeschlagen.');
  process.exitCode = 1;
});
