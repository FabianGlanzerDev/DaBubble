export interface AuthIssue {
  field: 'email' | 'password' | 'name' | 'general';
  message: string;
}

const issues: Record<string, AuthIssue> = {
  'auth/email-already-in-use': {
    field: 'email',
    message: 'Diese E-Mail-Adresse wird bereits verwendet.',
  },
  'auth/invalid-email': { field: 'email', message: 'Bitte gib eine gültige E-Mail-Adresse ein.' },
  'auth/weak-password': {
    field: 'password',
    message:
      'Das Passwort erfüllt die Sicherheitsanforderungen nicht. Verwende ein stärkeres Passwort.',
  },
  'auth/password-does-not-meet-requirements': {
    field: 'password',
    message: 'Das Passwort erfüllt die Passwortregeln dieses Projekts nicht.',
  },
  'auth/invalid-credential': {
    field: 'password',
    message: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  },
  'auth/wrong-password': {
    field: 'password',
    message: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  },
  'auth/user-not-found': {
    field: 'password',
    message: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  },
  'auth/user-disabled': {
    field: 'general',
    message: 'Dieses Konto ist deaktiviert. Bitte kontaktiere den Betreiber.',
  },
  'auth/too-many-requests': {
    field: 'general',
    message: 'Zu viele Versuche. Bitte warte etwas und versuche es erneut.',
  },
  'auth/network-request-failed': {
    field: 'general',
    message: 'Verbindung fehlgeschlagen. Bitte prüfe deine Internetverbindung.',
  },
  'auth/expired-action-code': {
    field: 'general',
    message: 'Dieser Link ist abgelaufen. Bitte fordere eine neue Reset-E-Mail an.',
  },
  'auth/invalid-action-code': {
    field: 'general',
    message:
      'Dieser Link ist ungültig oder wurde bereits verwendet. Bitte fordere eine neue Reset-E-Mail an.',
  },
  'auth/operation-not-allowed': {
    field: 'general',
    message: 'Die Anmeldung mit E-Mail und Passwort ist im Firebase-Projekt noch nicht aktiviert.',
  },
  'auth/unauthorized-continue-uri': {
    field: 'general',
    message: 'Diese Website ist im Firebase-Projekt noch nicht als erlaubte Domain eingerichtet.',
  },
  'permission-denied': {
    field: 'general',
    message: 'Zugriff auf das Profil verweigert. Bitte prüfe die Firestore-Regeln deines Projekts.',
  },
  unavailable: {
    field: 'general',
    message:
      'Das Profil konnte nicht geladen oder gespeichert werden. Bitte prüfe die Verbindung und versuche es erneut.',
  },
  'firebase/configuration': {
    field: 'general',
    message:
      'Firebase ist noch nicht eingerichtet. Die Webkonfiguration deines eigenen Projekts fehlt oder ist ungültig.',
  },
  'auth/busy': {
    field: 'general',
    message: 'Eine Aktion wird bereits ausgeführt. Bitte warte kurz.',
  },
};

export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) return String(error.code);
  return error instanceof Error ? error.message : '';
}

export function authIssue(error: unknown): AuthIssue {
  return (
    issues[errorCode(error)] ?? {
      field: 'general',
      message: 'Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    }
  );
}
