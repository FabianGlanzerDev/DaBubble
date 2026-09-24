/** Names and avatar positions from the supplied desktop reference; not real accounts. */
export interface WorkspaceItem {
  readonly id: string;
  readonly label: string;
  readonly avatar?: number;
}
export const channels: readonly WorkspaceItem[] = [
  { id: 'entwicklerteam', label: 'Entwicklerteam' },
  { id: 'office-team', label: 'Office-team' },
];
export const directMessages: readonly WorkspaceItem[] = [
  { id: 'frederik-beck', label: 'Frederik Beck (Du)', avatar: 2 },
  { id: 'sofia-mueller', label: 'Sofia Müller', avatar: 4 },
  { id: 'noah-braun', label: 'Noah Braun', avatar: 5 },
  { id: 'elise-roth', label: 'Elise Roth', avatar: 0 },
  { id: 'elias-neumann', label: 'Elias Neumann', avatar: 1 },
  { id: 'steffen-hoffmann', label: 'Steffen Hoffmann', avatar: 3 },
];
