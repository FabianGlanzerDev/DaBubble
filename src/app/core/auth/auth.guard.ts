import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

/** Wait for Firebase's persisted session; UI guards complement Firestore rules. */
export const authGuard: CanActivateFn = async (route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  await session.ready;
  if (!session.profile() && state.url.startsWith('/chat')) await session.reloadProfile();
  return (
    session.user() !== null ||
    router.createUrlTree(['/anmeldung'], {
      queryParams: { returnUrl: state.url, hinweis: 'anmeldung-ausstehend' },
    })
  );
};
