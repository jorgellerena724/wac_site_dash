import {
  Injectable,
  Inject,
  PLATFORM_ID,
  OnDestroy,
  inject,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, Subscription } from 'rxjs';
import { catchError, filter, map, distinctUntilChanged } from 'rxjs/operators';
import { ConfigService } from '../../shared/services/system/config.service';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from '../../shared/services/system/notification.service';
import { TranslocoService } from '@jsverse/transloco';

interface User {
  id: string;
  full_name: string;
  email: string;
  exp: number;
  client: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private config = inject(ConfigService);
  private redirectExecuted = false;
  private initialNavigationChecked = new BehaviorSubject<boolean>(false);
  public initialNavigationChecked$ =
    this.initialNavigationChecked.asObservable();

  private tokenSubject = new BehaviorSubject<string | null>(null);
  private userSubject = new BehaviorSubject<User | null>(null);

  private inactivityTimer: any;
  private tokenExpirationTimer: any;
  private warningTimer: any;
  private lastActivityTime = Date.now();
  private isLoggingOut = false;
  private eventListenersAdded = false;
  private activityHandler: ((event: Event) => void) | null = null;
  private navigationSubscription: Subscription | null = null;

  private readonly INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos
  private readonly WARNING_BEFORE_TIMEOUT = 1 * 60 * 1000; // 1 minuto

  // ---> AÑADIDO: Inyección de TranslocoService usando 'inject'
  private transloco = inject(TranslocoService);

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationSrv: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.loadInitialState();
    this.setupNavigationTracking();
  }

  // ... (el resto de los métodos hasta resetInactivityTimer se mantienen igual)
  private setupNavigationTracking(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.navigationSubscription = this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          distinctUntilChanged(
            (a, b) => (a as NavigationEnd).url === (b as NavigationEnd).url,
          ),
        )
        .subscribe((event: NavigationEnd) => {
          if (
            this.isLoggedIn() &&
            event.url !== '/login' &&
            event.url !== '/' &&
            !event.url.includes('login')
          ) {
            try {
              localStorage.setItem('lastPath', event.url);
            } catch (error) {
              console.warn('Error saving lastPath:', error);
            }
          }
        });
    }
  }

  public getLastPath(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        return localStorage.getItem('lastPath');
      } catch (error) {
        console.warn('Error getting lastPath:', error);
        return null;
      }
    }
    return null;
  }

  public clearLastPath(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem('lastPath');
      } catch (error) {
        console.warn('Error clearing lastPath:', error);
      }
    }
  }

  private setupActivityListeners(): void {
    if (isPlatformBrowser(this.platformId) && !this.eventListenersAdded) {
      const events = [
        'mousedown',
        'mousemove',
        'keypress',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'input',
        'focus',
      ];

      this.activityHandler = this.createDebouncedHandler();

      events.forEach((event) => {
        document.addEventListener(event, this.activityHandler!, {
          passive: true,
        });
      });

      this.eventListenersAdded = true;
    }
  }

  private createDebouncedHandler(): (event: Event) => void {
    let timeout: any;
    return (event: Event) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (this.user && !this.isLoggingOut) {
          this.resetInactivityTimer();
        }
      }, 1000);
    };
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
      this.navigationSubscription = null;
    }

    if (
      isPlatformBrowser(this.platformId) &&
      this.eventListenersAdded &&
      this.activityHandler
    ) {
      const events = [
        'mousedown',
        'mousemove',
        'keypress',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'input',
        'focus',
      ];

      events.forEach((event) => {
        document.removeEventListener(event, this.activityHandler!);
      });

      this.eventListenersAdded = false;
      this.activityHandler = null;
    }

    this.clearAllTimers();
  }

  private clearAllTimers(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  public loadInitialState(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const sessionToken = localStorage.getItem('token');
        const sessionUser = localStorage.getItem('user');

        if (sessionToken && sessionUser) {
          const user = JSON.parse(sessionUser) as User;

          if (user.exp && Date.now() >= user.exp) {
            this.logout(false); // No mostrar notificación al iniciar la app
            this.initialNavigationChecked.next(true);
            return;
          }

          this.tokenSubject.next(sessionToken);
          this.userSubject.next(user);
          this.setupExpirationTimer(user.exp);
          this.setupActivityListeners();
          this.resetInactivityTimer();

          if (!this.redirectExecuted) {
            this.redirectExecuted = true;
            this.redirectAfterLogin();
          }
        } else {
          this.initialNavigationChecked.next(true);
        }
      } catch (error) {
        console.error('Error loading initial state:', error);
        this.logout(false); // No mostrar notificación al iniciar la app
        this.initialNavigationChecked.next(true);
      }
    } else {
      this.initialNavigationChecked.next(true);
    }
  }

  private decodeToken(token: string): User | null {
    if (!token) {
      return null;
    }
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) {
        return null;
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      const fullUser = JSON.parse(jsonPayload);
      const exp = fullUser.exp * 1000;
      const full_name = fullUser.full_name;
      const email = fullUser.email;
      const client = fullUser.client;
      const id = fullUser.id || fullUser.user_id || fullUser._id || email;

      return { id, full_name, email, exp, client };
    } catch (error) {
      console.error('Error decodificando token:', error);
      return null;
    }
  }

  public checkTokenExpiration(): boolean {
    const user = this.userSubject.value;
    if (user?.exp) {
      const currentTime = Date.now();
      return currentTime >= user.exp;
    }
    return false;
  }

  private setupExpirationTimer(expirationTime: number): void {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }

    const timeUntilExpiration = expirationTime - Date.now();

    if (timeUntilExpiration > 0) {
      this.tokenExpirationTimer = setTimeout(() => {
        if (!this.isLoggingOut) {
          this.CloseInactivity();
        }
      }, timeUntilExpiration);
    }
  }

  private resetInactivityTimer(): void {
    if (this.isLoggingOut) {
      return;
    }

    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);

    this.lastActivityTime = Date.now();

    this.warningTimer = setTimeout(() => {
      if (!this.isLoggingOut && this.user) {
        // MODIFICADO: Usar la clave de traducción para la advertencia de inactividad
        const warningMessage = this.transloco.translate(
          'notifications.session.inactivityWarning',
        );
        this.notificationSrv.addNotification(warningMessage, 'warning');
      }
    }, this.INACTIVITY_TIMEOUT - this.WARNING_BEFORE_TIMEOUT);

    this.inactivityTimer = setTimeout(() => {
      if (!this.isLoggingOut && this.user) {
        this.logout();
      }
    }, this.INACTIVITY_TIMEOUT);
  }

  isLoggedIn(): boolean {
    return !!this.user && !this.checkTokenExpiration();
  }

  public login(email: string, password: string): Observable<boolean> {
    const trimmedEmail = email.trim();
    const formData = new FormData();
    formData.append('email', trimmedEmail);
    formData.append('password', password);

    return this.http
      .post<LoginResponse>(`${this.config.api_security}sign-in/`, formData)
      .pipe(
        map((response: LoginResponse) => {
          if (response?.access_token) {
            const decodedToken = this.decodeToken(response.access_token);
            if (decodedToken) {
              if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('user', JSON.stringify(decodedToken));
              }
              this.tokenSubject.next(response.access_token);
              this.userSubject.next(decodedToken);
              this.setupExpirationTimer(decodedToken.exp);
              this.setupActivityListeners();
              this.resetInactivityTimer();
              return true;
            }
          }
          return false;
        }),
        catchError((errorResponse: HttpErrorResponse) => {
          console.error('Error en login:', errorResponse);
          return throwError(() => errorResponse);
        }),
      );
  }

  public CloseInactivity(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.clearAllTimers();
    this.tokenSubject.next(null);
    this.userSubject.next(null);
    this.cleanupAndRedirect();
  }

  public logout(showNotification: boolean = true): void {
    if (this.isLoggingOut) return;

    this.isLoggingOut = true;
    this.clearAllTimers();
    this.tokenSubject.next(null);
    this.userSubject.next(null);

    // Solo mostrar notificación si se solicita explícitamente
    if (showNotification) {
      // MODIFICADO: Usar la clave de traducción para el cierre de sesión
      const logoutMessage = this.transloco.translate(
        'notifications.session.logoutSuccess',
      );
      this.notificationSrv.addNotification(logoutMessage, 'success');
    }

    this.cleanupAndRedirect();
  }

  private cleanupAndRedirect(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (this.router.url !== '/login' && this.router.url !== '/') {
          localStorage.setItem('lastPath', this.router.url);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    }

    setTimeout(() => {
      this.router.navigate(['/login'], { replaceUrl: true });
      this.isLoggingOut = false;
    }, 0);
  }

  public updateUser(newUserData: Partial<User>): void {
    const currentUser = this.userSubject.value;
    if (currentUser && isPlatformBrowser(this.platformId)) {
      try {
        const updatedUser = { ...currentUser, ...newUserData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        this.userSubject.next(updatedUser);
      } catch (error) {
        console.warn('Error updating user:', error);
      }
    }
  }

  public get user(): User | null {
    return this.userSubject.value;
  }

  public get token(): string | null {
    return this.tokenSubject.value;
  }

  public redirectAfterLogin(): void {
    if (isPlatformBrowser(this.platformId) && this.isLoggedIn()) {
      setTimeout(() => {
        const lastPath = this.getLastPath();
        if (
          lastPath &&
          lastPath !== '/login' &&
          lastPath !== '/' &&
          !lastPath.includes('login')
        ) {
          this.router.navigateByUrl(lastPath, { replaceUrl: true });
        } else {
          this.router.navigate(['/admin'], { replaceUrl: true });
        }
        this.initialNavigationChecked.next(true);
      }, 100);
    } else {
      this.initialNavigationChecked.next(true);
    }
  }

  public getClient(): string | null {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.client || null;
      } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
      }
    }
    return null;
  }
}
