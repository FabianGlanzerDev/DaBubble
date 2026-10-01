/** Public, fictional identities and messages; no real account is created or added to these channels. */
export const demoProfiles = [
  { uid: 'demo-mila', name: 'Mila (Demo)', avatarId: 1, demo: true },
  { uid: 'demo-noah', name: 'Noah (Demo)', avatarId: 2, demo: true },
];

/** Stable, explicitly public rooms whose metadata is maintained by the operator, not by visitors. */
export const demoChannels = [
  {
    id: 'demo-willkommen',
    name: 'willkommen-demo',
    description:
      'Öffentlicher Einstieg: Schreiben, Threads und Reaktionen ausprobieren. Sichtbar für alle angemeldeten Nutzer und Gäste.',
  },
  {
    id: 'demo-spielwiese',
    name: 'spielwiese-demo',
    description:
      'Öffentlicher Test-Channel. Eigene Beiträge können bearbeitet und gelöscht werden. Private Channels erstellst du über das Plus.',
  },
];

/** Seed posts remain distinguishable from visitors' real, independently owned messages. */
export const demoMessages = [
  {
    room: 'demo-willkommen',
    id: 'start',
    authorId: 'demo-mila',
    text: 'Willkommen bei DaBubble! 👋 Dieser Demo-Channel ist öffentlich für alle angemeldeten Besucher. Schreibe eine Nachricht, reagiere mit einem Emoji oder öffne einen Thread.',
    rootId: '',
  },
  {
    room: 'demo-willkommen',
    id: 'privacy',
    authorId: 'demo-noah',
    text: 'Mila und Noah sind fiktive Demo-Profile. Sie antworten nicht automatisch. Eigene Channels und Direktgespräche bleiben privat; hier bitte keine vertraulichen Angaben posten.',
    rootId: '',
  },
  {
    room: 'demo-willkommen',
    id: 'thread',
    authorId: 'demo-noah',
    text: 'Hier ist ein Beispiel-Thread. Deine Antwort wird wirklich gespeichert. ✨',
    rootId: 'start',
  },
  {
    room: 'demo-spielwiese',
    id: 'try',
    authorId: 'demo-mila',
    text: 'Deine Spielwiese 🚀 Probiere Schreiben, Bearbeiten, Löschen und Reaktionen mit deinen eigenen Beiträgen aus. Nachrichten anderer Besucher kannst du nicht verändern.',
    rootId: '',
  },
];
