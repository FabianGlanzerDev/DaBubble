/** Minimal authentication identity exposed to the UI without credentials or Firebase tokens. */
export interface AccountIdentity {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  displayName: string | null;
  providerIds: string[];
}

/** Editable display name and supplied-avatar index submitted to profile validation. */
export interface ProfileDraft {
  name: string;
  avatarId: number;
}

/** Validated public-facing profile fields associated with a Firebase UID. */
export interface UserProfile extends ProfileDraft {
  uid: string;
}

/** Checks a nonblank name of at most 80 characters and one of the six supported avatar indices. */
export function validProfileDraft(draft: ProfileDraft): boolean {
  return (
    !!draft.name.trim() &&
    draft.name.trim().length <= 80 &&
    Number.isInteger(draft.avatarId) &&
    draft.avatarId >= 0 &&
    draft.avatarId <= 5
  );
}

/** Rejects malformed or mismatched Firestore profiles before exposing them to the application. */
export function readUserProfile(value: Record<string, unknown>, uid: string): UserProfile {
  if (
    value['uid'] !== uid ||
    typeof value['name'] !== 'string' ||
    typeof value['avatarId'] !== 'number'
  )
    throw new Error('invalid-profile');
  const profile = { uid, name: value['name'], avatarId: value['avatarId'] };
  if (!validProfileDraft(profile)) throw new Error('invalid-profile');
  return profile;
}
