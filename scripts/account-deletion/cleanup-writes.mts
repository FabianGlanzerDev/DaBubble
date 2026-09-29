import type { Firestore, WriteBatch } from 'firebase-admin/firestore';

/** Deferred Firestore batch mutation applied only inside the operator's reviewed cleanup workflow. */
export type Write = (batch: WriteBatch) => void;
/** Renews the deletion lease before committing at most 350 queued writes per batch. */
export async function commitChunks(
  db: Firestore,
  changes: Write[],
  heartbeat: () => Promise<void>,
): Promise<void> {
  for (let i = 0; i < changes.length; i += 350) {
    await heartbeat();
    const batch = db.batch();
    for (const change of changes.slice(i, i + 350)) change(batch);
    await batch.commit();
  }
}
