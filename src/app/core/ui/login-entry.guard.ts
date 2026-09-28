import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Animate a newly opened login document; internal navigation and logout stay immediate. */
export const loginEntryGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  return (
    router.lastSuccessfulNavigation() !== null ||
    router.createUrlTree(['/intro'], { queryParams: route.queryParams })
  );
};
