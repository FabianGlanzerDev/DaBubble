import { createHash } from 'node:crypto';
import type { DeletionContext } from './environment.mts';
import { isMissingAuth } from './environment.mts';
import type { RoomInventory, Row } from './room-content.mts';
import { roomImpact } from './room-impact.mts';

/** Reads the account identity needed for review; only a missing Auth user counts as absence. */
export async function describeAccount(context: DeletionContext, uid: string) {
  try {
    const user = await context.auth.getUser(uid);
    return {
      email: user.email ?? null,
      providerIds: user.providerData.map((provider) => provider.providerId).sort(),
      createdAt: user.metadata.creationTime,
    };
  } catch (error) {
    if (!isMissingAuth(error)) throw error;
    return null;
  }
}

/** Initializes counts in the stable fingerprint order used by earlier reviewed plans. */
function emptyImpact() {
  return {
    ownMessages: 0,
    ownReactions: 0,
    threadPlaceholders: 0,
    foreignReactionsOnOwnMessages: 0,
    foreignMessagesPreserved: 0,
    directArchives: 0,
  };
}

/** Aggregates impacts with stable property ordering so existing review fingerprints remain comparable. */
function totals(rooms: RoomInventory[], uid: string) {
  const sum = emptyImpact();
  for (const room of rooms) {
    const impact = roomImpact(room, uid);
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += impact[key];
  }
  return sum;
}

/** Confirmed account identity included in the stable review fingerprint. */
type PlanIdentity = { project: string; uid: string; accountExists: boolean };
/** Private profile and public directory existence captured during the same inventory. */
type Profiles = { profile: Row; directory: Row; proof: Row };

/** Summarizes existence and cleanup effects without including shared message contents. */
export function summarizePlan(identity: PlanIdentity, profiles: Profiles, rooms: RoomInventory[]) {
  return {
    ...identity,
    database: '(default)',
    profileExists: profiles.profile.exists,
    directoryExists: profiles.directory.exists,
    proofExists: profiles.proof.exists,
    rooms: rooms.length,
    ...totals(rooms, identity.uid),
    sharedTextReview:
      'Fremde Texte, Zitate, Namen und Beschreibungen werden nicht automatisch bereinigt.',
  };
}

/** Binds the operator's confirmation to metadata, Auth identity and every affected document version. */
export function fingerprintPlan(
  summary: unknown,
  account: unknown,
  profiles: Row[],
  rooms: RoomInventory[],
): string {
  const versions = [
    ...profiles,
    ...rooms.flatMap((room) => [room.room, ...room.messages, ...room.reactions]),
  ]
    .map((item) => item.ref.path + ':' + item.version)
    .sort();
  return createHash('sha256').update(JSON.stringify({ summary, account, versions })).digest('hex');
}
