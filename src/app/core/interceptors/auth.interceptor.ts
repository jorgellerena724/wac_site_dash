import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Obtener el token desde el AuthService
  const token = authService.token;

  // Clonar la solicitud y agregar el token si existe
  let authReq = req;

  if (token) {
    authReq = req.clone({
      // Eliminar withCredentials ya que no usamos cookies
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  // Continuar con la solicitud modificada
  return next(authReq).pipe(
    catchError((error) => {
      // Manejar errores de autenticación
      if (error.status === 401) {
        // Token inválido o expirado (sin notificación automática)
        authService.logout(false);
      } else if (error.status === 403) {
        // No autorizado - podrías redirigir a una página de acceso denegado
        console.warn('Acceso denegado');
      }
      return throwError(() => error);
    })
  );
};
