import { PreviewMessage } from './message-preview';

/** Static text from the supplied Figma export, not a claim about current Angular versions. */
export const question: PreviewMessage = {
  author: 'Noah Braun',
  avatar: 5,
  time: '14:25',
  text: 'Welche Version ist aktuell von Angular?',
};
export const channelMessages: readonly PreviewMessage[] = [
  { ...question, replies: true },
  {
    author: 'Frederik Beck',
    avatar: 2,
    time: '15:06',
    own: true,
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.',
    reactions: ['🚀', '✅'],
  },
];
export const threadReplies: readonly PreviewMessage[] = [
  {
    author: 'Sofia Müller',
    avatar: 4,
    time: '14:30',
    text: 'Ich habe die gleiche Frage. Ich habe gegoogelt und es scheint, dass die aktuelle Version Angular 13 ist. Vielleicht weiß Frederik, ob es wahr ist.',
    reactions: ['🤓'],
  },
  {
    author: 'Frederik Beck',
    avatar: 2,
    time: '15:06',
    own: true,
    text: 'Ja das ist es.',
    reactions: ['👍'],
  },
];
