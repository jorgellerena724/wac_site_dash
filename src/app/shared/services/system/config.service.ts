import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = new HttpClient(inject(HttpBackend));
  private platformId = inject(PLATFORM_ID);
  private loaded = false;

  api = environment.api;
  api_users = environment.api_users;
  api_security = environment.api_security;
  api_img = environment.api_img;
  imgPath = environment.imgPath;

  load(): Promise<void> {
    // Si ya cargó o estamos en SSR, no hace nada
    if (this.loaded || !isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    this.loaded = true;

    return firstValueFrom(
      this.http.get<{ apiUrl: string }>('assets/config/config.json').pipe(
        catchError(() => {
          console.warn('config.json no encontrado, usando environment');
          return of(null);
        }),
      ),
    ).then((result) => {
      if (!result?.apiUrl) return; // sin config.json → ya tiene los defaults del environment

      const apiUrl = result.apiUrl;
      this.api = apiUrl;
      this.api_users = `${apiUrl}users/`;
      this.api_security = `${apiUrl}auth/`;
      this.api_img = `${apiUrl}images/`;
    });
  }
}
