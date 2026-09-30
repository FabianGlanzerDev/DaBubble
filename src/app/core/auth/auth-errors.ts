/** Safe, field-specific feedback that can be rendered without exposing a raw service response. */
export interface AuthIssue {
  field: 'email' | 'password' | 'name' | 'general';
  message: string;
  retainOnSignOut?: boolean;
}

const issues: Record<string, AuthIssue> = {
  'auth/session-ended': {
    field: 'general',
    retainOnSignOut: true,
    message:
      'Eine Abmeldung in einem anderen Tab hat diesen Anmeldeversuch beendet. Bitte melde dich erneut an.',
  },
  'registration/storage-unavailable': {
    field: 'general',
    message:
      'Der Registrierungsfortschritt kann nicht gespeichert werden. Bitte erlaube den Sitzungsspeicher für diese Website und versuche es erneut.',
  },
  'auth/email-already-in-use': {
    field: 'email',
    message: 'Diese E-Mail-Adresse wird bereits verwendet.',
  },
  'auth/invalid-google-response': {
    field: 'general',
    message: 'Google hat die Anmeldung nicht vollständig bestätigt. Bitte versuche es erneut.',
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
  'auth/unsupported-email-action': {
    field: 'general',
    message:
      'Diese E-Mail-Aktion wird in DaBubble noch nicht unterstützt. Hier kannst du ausschließlich dein Passwort zurücksetzen. Bitte kontaktiere den Betreiber, wenn du eine andere Kontoaktion durchführen möchtest.',
  },
  'auth/operation-not-allowed': {
    field: 'general',
    message: 'Diese Anmeldemethode ist im Firebase-Projekt noch nicht aktiviert.',
  },
  'auth/admin-restricted-operation': {
    field: 'general',
    message: 'Diese Kontoaktion ist derzeit gesperrt. Bitte kontaktiere den Betreiber.',
  },
  'auth/popup-closed-by-user': {
    field: 'general',
    message: 'Google-Anmeldung abgebrochen. Dein bisheriger Zugang bleibt erhalten.',
  },
  'auth/cancelled-popup-request': {
    field: 'general',
    message: 'Google-Anmeldung abgebrochen. Bitte starte nur ein Anmeldefenster.',
  },
  'auth/popup-blocked': {
    field: 'general',
    message:
      'Das Anmeldefenster wurde blockiert. Erlaube Pop-ups für diese Website und versuche es erneut.',
  },
  'auth/unauthorized-domain': {
    field: 'general',
    message: 'Diese Domain ist für die Firebase-Anmeldung noch nicht freigegeben.',
  },
  'auth/account-exists-with-different-credential': {
    field: 'general',
    message:
      'Für diese E-Mail-Adresse besteht bereits ein anderer Zugang. Melde dich mit deiner bisherigen Anmeldemethode an. Die App führt keine Konten oder Chatdaten zusammen.',
  },
  'auth/credential-already-in-use': {
    field: 'general',
    message:
      'Dieses Google-Konto gehört bereits zu einem anderen DaBubble-Konto. Dein bisheriger Zugang bleibt erhalten. Es werden keine Konten zusammengeführt.',
  },
  'auth/provider-already-linked': {
    field: 'general',
    message: 'Google ist mit diesem Konto bereits verknüpft.',
  },
  'auth/session-active': {
    field: 'general',
    message:
      'Es besteht bereits eine Anmeldung. Wähle im Profilmenü „Log out“, bevor du ein anderes Konto verwendest.',
  },
  'auth/sign-out-incomplete': {
    field: 'general',
    message:
      'Die Abmeldung wurde nicht abgeschlossen. Bitte versuche es erneut. Dein Konto bleibt erhalten.',
  },
  'auth/guest-switch-confirmation-required': {
    field: 'general',
    message:
      'Dein Gastzugang bleibt aktiv. Wähle im Chat-Profilmenü „Log out“ und bestätige die Abmeldung, bevor du ein anderes Konto verwendest. „Konto erstellen“ behält deine Gastkennung und Chats.',
  },
  'auth/guest-account-active': {
    field: 'general',
    message:
      'Ein persönliches Konto ist aktiv. Melde dich zuerst ab, um den Gastzugang zu öffnen. Dein Konto bleibt erhalten.',
  },
  'auth/requires-recent-login': {
    field: 'general',
    message: 'Bitte melde dich erneut an, bevor du diese Kontoaktion ausführst.',
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
      'Die Anmeldung ist derzeit nicht verfügbar. Bitte versuche es später erneut oder kontaktiere den Betreiber.',
  },
  'auth/busy': {
    field: 'general',
    message: 'Eine Aktion wird bereits ausgeführt. Bitte warte kurz.',
  },
};

/** Extracts an SDK error code or a local Error message for the controlled feedback lookup. */
export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) return String(error.code);
  return error instanceof Error ? error.message : '';
}

/** Maps known failures to form fields and uses neutral feedback for unrecognized errors. */
export function authIssue(error: unknown): AuthIssue {
  return (
    issues[errorCode(error)] ?? {
      field: 'general',
      message: 'Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    }
  );
}

/** Guest-specific feedback; never expose raw Firebase responses or credentials. */
export function guestIssue(error: unknown): AuthIssue {
  const code = errorCode(error);
  if (['auth/admin-restricted-operation', 'auth/operation-not-allowed'].includes(code))
    return {
      field: 'general',
      message:
        'Der Gastzugang ist noch nicht aktiviert oder wurde vom Betreiber gesperrt. Bitte nutze die Anmeldung oder kontaktiere den Betreiber.',
    };
  return issues[code] ?? unknownGuestIssue(code);
}

/** Includes only a syntactically safe Auth error code in otherwise generic guest feedback. */
function unknownGuestIssue(code: string): AuthIssue {
  const reference = /^auth\/[a-z][a-z0-9-]{1,80}$/.test(code) ? ` (Fehlercode: ${code})` : '';
  return {
    field: 'general',
    message:
      'Der Gastzugang konnte nicht geöffnet werden. Bitte versuche es erneut oder nutze die Anmeldung.' +
      reference,
  };
}
