import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, Observable, take } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoginGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | Observable<boolean> {
    // Si ya está autenticado, redirigir inmediatamente
    if (this.authService.isLoggedIn()) {
      this.performRedirect();
      return false;
    }

    // Si la verificación inicial aún no se completa, esperar
    return this.authService.initialNavigationChecked$.pipe(
      take(1),
      map(() => {
        if (this.authService.isLoggedIn()) {
          this.performRedirect();
          return false;
        }
        return true;
      })
    );
  }

  private performRedirect(): void {
    const lastPath = this.authService.getLastPath();
    const redirectPath =
      lastPath && lastPath !== '/login' && lastPath !== '/'
        ? lastPath
        : '/dashboard';

    this.router.navigateByUrl(redirectPath, { replaceUrl: true });
  }
}
