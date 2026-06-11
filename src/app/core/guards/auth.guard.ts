import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    // Verificar si el usuario está autenticado (basado solo en la existencia del token)
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return false;
    }

    // Verificar si el token no ha expirado
    if (this.authService.checkTokenExpiration()) {
      // Token expirado, hacer logout y redirigir (sin notificación automática)
      this.authService.logout(false);
      this.router.navigate(['/login'], { replaceUrl: true });
      return false;
    }

    // Usuario autenticado y token válido
    return true;
  }
}
