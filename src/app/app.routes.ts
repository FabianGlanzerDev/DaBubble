import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

const liveChildren: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Arbeitsbereich · DaBubble',
    loadComponent: () => import('./features/chat-live/live-overview').then((m) => m.LiveOverview),
  },
  {
    path: 'neue-nachricht',
    title: 'Neue Nachricht · DaBubble',
    loadComponent: () => import('./features/chat-live/live-overview').then((m) => m.LiveOverview),
  },
  {
    path: 'channels/:id',
    title: 'Channel · DaBubble',
    loadComponent: () =>
      import('./features/chat-live/live-conversation').then((m) => m.LiveConversation),
  },
  {
    path: 'direkt/:id',
    title: 'Direktnachricht · DaBubble',
    loadComponent: () =>
      import('./features/chat-live/live-conversation').then((m) => m.LiveConversation),
  },
];

const workspaceChildren: Routes = [
  {
    path: 'neue-nachricht',
    title: 'Neue Nachricht · DaBubble',
    loadComponent: () =>
      import('./features/chat/workspace-overview').then((m) => m.WorkspaceOverview),
  },
  // Preserve links from the initial layout with its provisional sample names.
  { path: 'channels/allgemein', redirectTo: 'channels/entwicklerteam', pathMatch: 'full' },
  { path: 'channels/projekt', redirectTo: 'channels/entwicklerteam', pathMatch: 'full' },
  { path: 'direkt/beispielkontakt', redirectTo: 'direkt/noah-braun', pathMatch: 'full' },
  {
    path: '',
    pathMatch: 'full',
    title: 'Arbeitsbereich · DaBubble',
    loadComponent: () =>
      import('./features/chat/workspace-overview').then((m) => m.WorkspaceOverview),
  },
  {
    path: 'channels/:id',
    title: 'Channel · DaBubble',
    data: { kind: 'channel' },
    loadComponent: () => import('./features/chat/conversation').then((m) => m.Conversation),
  },
  {
    path: 'direkt/:id',
    title: 'Direktnachricht · DaBubble',
    data: { kind: 'direct' },
    loadComponent: () => import('./features/chat/conversation').then((m) => m.Conversation),
  },
];

export const routes: Routes = [
  {
    path: 'impressum',
    title: 'Impressum · DaBubble',
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'datenschutz',
    title: 'Datenschutz · DaBubble',
    data: { privacy: true },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'intro' },
  {
    path: 'intro',
    title: 'Willkommen · DaBubble',
    loadComponent: () => import('./features/intro/intro').then((m) => m.Intro),
  },
  {
    path: 'anmeldung',
    title: 'Anmeldung · DaBubble',
    data: { mode: 'login' },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'registrierung',
    title: 'Registrierung · DaBubble',
    data: { mode: 'register' },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'passwort-reset',
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Passwort zurücksetzen · DaBubble',
        data: { mode: 'request' },
        loadComponent: () => import('./features/auth/password-page').then((m) => m.PasswordPage),
      },
      {
        path: 'neues-passwort',
        title: 'Neues Passwort · DaBubble',
        data: { mode: 'reset' },
        loadComponent: () => import('./features/auth/password-page').then((m) => m.PasswordPage),
      },
    ],
  },
  {
    path: 'meldungen-vorschau',
    title: 'Bestätigungsmeldungen · Designvorschau · DaBubble',
    loadComponent: () =>
      import('./features/auth/confirmation-preview').then((m) => m.ConfirmationPreview),
  },
  {
    path: 'avatar-vorschau',
    title: 'Avatar-Vorschau · DaBubble',
    loadComponent: () => import('./features/auth/avatar-page').then((m) => m.AvatarPage),
  },
  {
    path: 'avatar-auswahl',
    title: 'Profil vervollständigen · DaBubble',
    canActivate: [authGuard],
    data: { account: true },
    loadComponent: () => import('./features/auth/avatar-page').then((m) => m.AvatarPage),
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./features/chat-live/live-layout').then((m) => m.LiveLayout),
    children: liveChildren,
  },
  {
    path: 'vorschau',
    data: { preview: true },
    loadComponent: () => import('./features/chat/chat-layout').then((m) => m.ChatLayout),
    children: workspaceChildren,
  },
  {
    path: '**',
    title: 'Seite nicht gefunden · DaBubble',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
