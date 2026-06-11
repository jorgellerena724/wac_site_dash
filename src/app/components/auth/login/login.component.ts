import {
  Component,
  inject,
  PLATFORM_ID,
  signal,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { getLucideIcon, icons } from '../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [ReactiveFormsModule, TranslocoModule, LucideDynamicIcon],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  // Método para obtener iconos
  readonly getIcon = getLucideIcon;
  readonly icons = icons;
  // Servicios
  private transloco = inject(TranslocoService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  protected readonly imgPath = environment.imgPath;

  // Signals
  isLoading = signal<boolean>(false);
  languageMenuOpen = signal<boolean>(false);
  currentLanguage = signal<string>('Español');
  currentLanguageCode = signal<string>('es');
  showPassword = signal<boolean>(false);

  // Formulario
  loginForm: FormGroup;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    // Sincronizar el idioma al iniciar el componente
    if (isPlatformBrowser(this.platformId)) {
      const savedLang = localStorage.getItem('selectedLang');
      const active = this.transloco.getActiveLang();
      if (savedLang && savedLang !== active) {
        this.transloco.setActiveLang(savedLang);
      }
    }

    this.syncWithTransloco();

    // Suscripción a cambios de idioma
    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lang) => {
        this.updateLanguageDisplay(lang);
      });
  }

  toggleLanguageMenu() {
    this.languageMenuOpen.update((v) => !v);
  }

  togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
  }

  private syncWithTransloco() {
    const currentLang = this.transloco.getActiveLang();
    this.updateLanguageDisplay(currentLang);
  }

  private updateLanguageDisplay(lang: string) {
    this.currentLanguageCode.set(lang);
    if (lang === 'es') {
      this.currentLanguage.set('Español');
    } else if (lang === 'en') {
      this.currentLanguage.set('English');
    }
  }

  selectLanguage(lang: string) {
    this.currentLanguageCode.set(lang);
    this.transloco.setActiveLang(lang);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedLang', lang);
    }

    if (lang === 'es') {
      this.currentLanguage.set('Español');
    } else if (lang === 'en') {
      this.currentLanguage.set('English');
    }
    this.languageMenuOpen.set(false);
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      const { email, password } = this.loginForm.value;

      this.authService
        .login(email, password)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (success) => {
            if (success) {
              this.transloco
                .selectTranslate('notifications.login.success')
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe((successMessage) => {
                  this.notificationSrv.addNotification(
                    successMessage,
                    'success',
                  );
                  this.router.navigate(['/admin']);
                });
            }
            this.isLoading.set(false);
          },
          error: (errorResponse: HttpErrorResponse) => {
            this.isLoading.set(false);
            const serverErrorMessage = errorResponse?.error?.message;
            const statusCode = errorResponse?.status || 500;
            let notificationMessage: string;

            switch (statusCode) {
              case 400:
                notificationMessage =
                  serverErrorMessage || 'notifications.login.error.badRequest';
                break;
              case 401:
                notificationMessage =
                  serverErrorMessage ||
                  'notifications.login.error.invalidCredentials';
                break;
              case 404:
                notificationMessage =
                  serverErrorMessage ||
                  'notifications.login.error.invalidCredentials';
                break;
              case 500:
                notificationMessage = 'notifications.login.error.serverError';
                break;
              case 502:
              case 0:
                notificationMessage =
                  'notifications.login.error.connectionError';
                break;
              default:
                notificationMessage =
                  serverErrorMessage || 'notifications.login.error.unexpected';
                break;
            }

            if (serverErrorMessage) {
              this.notificationSrv.addNotification(serverErrorMessage, 'error');
            } else {
              this.transloco
                .selectTranslate(notificationMessage)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe((msg) =>
                  this.notificationSrv.addNotification(msg, 'error'),
                );
            }
          },
        });
    } else {
      this.transloco
        .selectTranslate('notifications.login.error.invalidForm')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((invalidFormMessage) =>
          this.notificationSrv.addNotification(invalidFormMessage, 'error'),
        );
      this.loginForm.markAllAsTouched();
    }
  }
}
