/** Identifies a selected person at an exact range in the editable, human-readable message. */
export interface PersonMention {
  start: number;
  end: number;
  uid: string;
}

/** Keeps mention identity separate from the visible text while a draft is edited. */
export interface MessageDraft {
  text: string;
  mentions: PersonMention[];
}

/** Decodes only explicit UID tokens; arbitrary text and legacy name-only mentions remain unchanged. */
export function decodeMessage(text: string): MessageDraft {
  const draft: MessageDraft = { text: '', mentions: [] };
  let offset = 0;
  for (const match of text.matchAll(/<@([A-Za-z0-9_-]+)\|([^<>]*)>/g)) {
    draft.text += text.slice(offset, match.index);
    appendMention(draft, match[1]!, match[2]!);
    offset = match.index + match[0].length;
  }
  draft.text += text.slice(offset);
  return draft;
}

/** Adds a decoded label with its stable identity, retaining malformed tokens as harmless plain text. */
function appendMention(draft: MessageDraft, uid: string, label: string): void {
  try {
    const name = '@' + decodeURIComponent(label);
    draft.mentions.push({ start: draft.text.length, end: draft.text.length + name.length, uid });
    draft.text += name;
  } catch {
    draft.text += '<@' + uid + '|' + label + '>';
  }
}

/** Serializes selected identities into the existing text field without changing Firestore document permissions. */
export function encodeMessage(draft: MessageDraft): string {
  let text = draft.text;
  for (const mention of [...draft.mentions].reverse()) {
    const label = encodeURIComponent(draft.text.slice(mention.start + 1, mention.end));
    const token = `<@${mention.uid}|${label}>`;
    text = text.slice(0, mention.start) + token + text.slice(mention.end);
  }
  return text;
}

/** Preserves unaffected mention ranges while invalidating identities whose labels were edited. */
export function changeDraft(draft: MessageDraft, text: string): MessageDraft {
  const { start, oldEnd, newEnd } = changedRange(draft.text, text);
  const mentions = draft.mentions.flatMap((mention) => moveMention(mention, start, oldEnd, newEnd));
  return { text, mentions };
}

/** Finds the single replacement range shared by native typing, paste, selection and undo events. */
function changedRange(before: string, text: string) {
  let start = 0;
  while (start < text.length && start < before.length && text[start] === before[start]) start++;
  let oldEnd = before.length,
    newEnd = text.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === text[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, oldEnd, newEnd };
}

/** Retains, shifts or removes a mention according to its overlap with the edited range. */
function moveMention(
  mention: PersonMention,
  start: number,
  end: number,
  nextEnd: number,
): PersonMention[] {
  if (mention.end <= start) return [mention];
  if (mention.start < end) return [];
  const shift = nextEnd - end;
  return [{ ...mention, start: mention.start + shift, end: mention.end + shift }];
}
