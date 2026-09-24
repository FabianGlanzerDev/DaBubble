export interface AccountIdentity {
  uid: string;
  email: string | null;
}

export interface ProfileDraft {
  name: string;
  avatarId: number;
}

export interface UserProfile extends ProfileDraft {
  uid: string;
}

export function validProfileDraft(draft: ProfileDraft): boolean {
  return (
    !!draft.name.trim() &&
    draft.name.trim().length <= 80 &&
    Number.isInteger(draft.avatarId) &&
    draft.avatarId >= 0 &&
    draft.avatarId <= 5
  );
}

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
