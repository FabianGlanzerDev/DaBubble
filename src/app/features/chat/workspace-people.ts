/** Figma-provided display identity used only in local examples, including optional illustrated availability. */
export interface ExamplePerson {
  readonly id: string;
  readonly name: string;
  readonly avatar: number;
  readonly email: string;
  readonly away?: boolean;
}

/** Public design examples supplied by Figma, never authenticated users. */
export const examplePeople: readonly ExamplePerson[] = [
  { id: 'frederik-beck', name: 'Frederik Beck', avatar: 2, email: 'fred.beck@email.com' },
  { id: 'sofia-mueller', name: 'Sofia Müller', avatar: 4, email: 'sofia.muel@beispiel.com' },
  { id: 'noah-braun', name: 'Noah Braun', avatar: 5, email: 'noahbra@beispiel.com' },
  { id: 'elise-roth', name: 'Elise Roth', avatar: 0, email: 'rothelise@beispiel.com', away: true },
  { id: 'elias-neumann', name: 'Elias Neumann', avatar: 1, email: 'ichbinelias@beispiel.com' },
  { id: 'steffen-hoffmann', name: 'Steffen Hoffmann', avatar: 3, email: 'thehoffman@beispiel.com' },
];

/** Resolves a preview identity and falls back to the first supplied example for unknown IDs. */
export function findPerson(id: string | undefined): ExamplePerson {
  return examplePeople.find((person) => person.id === id) ?? examplePeople[0]!;
}
