import {
  Component,
  inject,
  signal,
  computed,
  effect,
  PLATFORM_ID,
  viewChild,
  input,
  ChangeDetectionStrategy,
  DestroyRef,
  HostListener,
  ElementRef,
} from '@angular/core';
import {
  RouterModule,
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  ModalService,
  ModalConfig,
} from '../../../shared/services/system/modal.service';
import { ChangeUserPasswordComponent } from '../../users/change-user-password/change-user-password.component';
import { BackupService } from '../../../shared/services/system/backup.service';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/app-confirm-dialog/app-confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { getLucideIcon, icons } from '../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslocoModule,
    ConfirmDialogComponent,
    LucideDynamicIcon,
    TooltipModule,
  ],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  // Método para obtener iconos
  readonly getIcon = getLucideIcon;
  readonly icons = icons;
  // Inputs
  sessionClient = input<string>();

  // Services
  private router = inject(Router);
  private authSrv = inject(AuthService);
  private modalSrv = inject(ModalService);
  private backupService = inject(BackupService);
  private notificationService = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);

  // ViewChild
  confirmDialog = viewChild.required<ConfirmDialogComponent>('confirmDialog');

  // Signals para el estado del menú
  mobileMenuOpen = signal(false);
  isHomeSubmenuOpen = signal(false);
  isAboutSubmenuOpen = signal(false);
  isProductsSubmenuOpen = signal(false);
  isPublicationsSubmenuOpen = signal(false);
  isContactSubmenuOpen = signal(false);
  isHeaderSubmenuOpen = signal(false);
  isStatisticsSubmenuOpen = signal(false);
  isUsersSubmenuOpen = signal(false);
  isChatbotSubmenuOpen = signal(false);
  languageMenuOpen = signal(false);
  userMenuOpen = signal(false);

  protected readonly imgPath = environment.imgPath;

  // Signals para idioma
  currentLanguage = signal<string>('Español');
  currentLanguageCode = signal<string>('es');

  // Signals para animación del título
  animatedTitle = signal<string>('');
  private animationInterval: any;

  // Signals para usuario
  userData = signal<any>(null);
  showUsersMenu = signal(true);
  showBackupButtons = signal(false);

  // Computed signal para la ruta actual
  currentUrl = computed(() => this.router.url);

  // Computed signals para rutas activas
  isHomeRouteActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/carousel') || url.includes('/news');
  });

  isAboutRouteActive = computed(() => {
    const url = this.currentUrl();
    return (
      url.includes('/company') ||
      url.includes('/manager-category') ||
      url.includes('/managers') ||
      url.includes('/reviews')
    );
  });

  isProductsRouteActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/categories') || url.includes('/products');
  });

  isPublicationsRouteActive = computed(() => {
    const url = this.currentUrl();
    return (
      url.includes('/publication-category') || url.includes('/publications')
    );
  });

  isContactRouteActive = computed(() => {
    return this.currentUrl().includes('/contact');
  });

  isHeaderRouteActive = computed(() => {
    return this.currentUrl().includes('/header');
  });

  isStatisticsRouteActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/statistics') || url.includes('/statistics-config');
  });

  isUsersRouteActive = computed(() => {
    return this.currentUrl().includes('/users');
  });

  isChatbotRouteActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/chatbot-models') || url.includes('/chatbot-config');
  });

  // Computed para cliente
  userClient = computed(() => {
    const data = this.userData();
    if (!data) {
      const clientStorage = this.getClientFromLocalStorage();
      return clientStorage ?? '—';
    }
    if (typeof data === 'string') {
      const clientStorage = this.getClientFromLocalStorage();
      return clientStorage ?? data ?? '—';
    }

    if (data.client) return String(data.client);
    if (data.session?.client) return String(data.session.client);
    if (data.user?.client) return String(data.user.client);
    if (data.client_name) return String(data.client_name);
    const clientFromStorage = this.getClientFromLocalStorage();
    return clientFromStorage ?? '—';
  });

  constructor() {
    // Suscribirse a eventos de navegación
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.mobileMenuOpen.set(false);
      });

    // Sincronizar con Transloco
    this.syncWithTransloco();

    // Cargar datos del usuario
    this.loadUserData();

    // Suscribirse a cambios de idioma
    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lang) => {
        this.updateLanguageDisplay(lang);
        this.startTitleAnimation();
      });

    // Iniciar animación del título
    if (isPlatformBrowser(this.platformId)) {
      this.startTitleAnimation();
    }

    // Effect para inicializar menú de usuarios
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.initShowUsersMenu();
      }
    });

    // Effect para detectar cambios en sessionClient
    effect(() => {
      const client = this.sessionClient();
      if (client !== undefined) {
        this.initShowUsersMenu();
      }
    });
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update((v) => !v);
  }

  saveInformation(): void {
    this.userMenuOpen.set(false);

    const notificationId = this.notificationService.addNotification(
      this.transloco.translate('navbar.backup.generating'),
      'info',
      true,
    );

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress < 90) {
        this.notificationService.updateProgress(notificationId, progress);
      }
    }, 200);

    this.backupService
      .downloadBackup()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          clearInterval(progressInterval);
          this.notificationService.updateProgress(notificationId, 100);

          setTimeout(() => {
            this.notificationService.removeNotificationById(notificationId);
          }, 500);

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;

          const date = new Date();
          const dateStr = date.toISOString().split('T')[0];
          link.download = `backup_${dateStr}.zip`;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          window.URL.revokeObjectURL(url);

          setTimeout(() => {
            this.notificationService.addNotification(
              this.transloco.translate('navbar.backup.download_success'),
              'success',
            );
          }, 1000);
        },
        error: (error) => {
          clearInterval(progressInterval);
          this.notificationService.removeNotificationById(notificationId);

          console.error('Error al descargar backup:', error);
          const errorMessage =
            error?.error?.detail ||
            error?.message ||
            this.transloco.translate('navbar.backup.download_error');
          const translatedMessage = this.transloco.translate(
            'navbar.backup.download_error_message',
            { message: errorMessage },
          );
          this.notificationService.addNotification(translatedMessage, 'error');
        },
      });
  }

  async restoreInformation(): Promise<void> {
    this.userMenuOpen.set(false);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';

    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.endsWith('.zip')) {
        this.notificationService.addNotification(
          this.transloco.translate('navbar.backup.invalid_file'),
          'error',
        );
        return;
      }

      const dialog = this.confirmDialog();
      dialog.title = this.transloco.translate('navbar.confirm_restore_title');
      dialog.message = this.transloco.translate('navbar.confirm_restore');
      dialog.confirmLabel = this.transloco.translate(
        'navbar.confirm_restore_button',
      );
      dialog.cancelLabel = this.transloco.translate('navbar.cancel_button');

      const confirmed = await dialog.show();
      if (!confirmed) return;

      const notificationId = this.notificationService.addNotification(
        this.transloco.translate('navbar.backup.restoring'),
        'info',
        true,
      );

      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 12;
        if (progress < 85) {
          this.notificationService.updateProgress(notificationId, progress);
        }
      }, 300);

      this.backupService
        .restoreBackup(file)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            clearInterval(progressInterval);
            this.notificationService.updateProgress(notificationId, 100);

            setTimeout(() => {
              this.notificationService.removeNotificationById(notificationId);
            }, 500);

            setTimeout(() => {
              this.notificationService.addNotification(
                this.transloco.translate('navbar.backup.restore_success'),
                'success',
              );
            }, 1000);

            setTimeout(() => {
              window.location.reload();
            }, 3000);
          },
          error: (error) => {
            clearInterval(progressInterval);
            this.notificationService.removeNotificationById(notificationId);

            console.error('Error al restaurar backup:', error);
            const errorMessage =
              error?.error?.detail ||
              error?.message ||
              this.transloco.translate('navbar.backup.restore_error');
            const translatedMessage = this.transloco.translate(
              'navbar.backup.restore_error_message',
              { message: errorMessage },
            );
            this.notificationService.addNotification(
              translatedMessage,
              'error',
            );
          },
        });
    };

    input.click();
  }

  changePassword(): void {
    this.userMenuOpen.set(false);
    const changePasswordTitle = this.transloco.translate('navbar.changepass');

    const modalConfig: ModalConfig = {
      title: changePasswordTitle,
      component: ChangeUserPasswordComponent,
      data: {
        initialData: {
          id: this.userData()?.id,
          email: this.userData()?.email,
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  toggleHomeSubmenu() {
    this.isHomeSubmenuOpen.update((v) => !v);
  }

  toggleAboutSubmenu(): void {
    this.isAboutSubmenuOpen.update((v) => !v);
  }

  toggleProductsSubmenu(): void {
    this.isProductsSubmenuOpen.update((v) => !v);
  }

  togglePublicationsSubmenu(): void {
    this.isPublicationsSubmenuOpen.update((v) => !v);
  }

  toggleContactSubmenu(): void {
    this.isContactSubmenuOpen.update((v) => !v);
  }

  toggleHeaderSubmenu(): void {
    this.isHeaderSubmenuOpen.update((v) => !v);
  }

  toggleStatisticsSubmenu(): void {
    this.isStatisticsSubmenuOpen.update((v) => !v);
  }

  toggleUsersSubmenu(): void {
    this.isUsersSubmenuOpen.update((v) => !v);
  }

  toggleChatbotSubmenu(): void {
    this.isChatbotSubmenuOpen.update((v) => !v);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  toggleLanguageMenu() {
    this.languageMenuOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Verificar si el clic fue en el botón o dropdown de idioma
    const languageButton = target.closest('#language-menu');
    const languageDropdown = target.closest(
      '[role="menu"][aria-labelledby="language-menu"]',
    );

    // Verificar si el clic fue en el botón o dropdown de usuario
    const userButton = target.closest('#user-menu');
    const userDropdown = target.closest(
      '[role="menu"][aria-labelledby="user-menu"]',
    );

    // Cerrar dropdown de idioma si el clic fue fuera de él
    if (!languageButton && !languageDropdown && this.languageMenuOpen()) {
      this.languageMenuOpen.set(false);
    }

    // Cerrar dropdown de usuario si el clic fue fuera de él
    if (!userButton && !userDropdown && this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  private closeOtherSubmenus(except: string | null) {
    if (except !== 'home') this.isHomeSubmenuOpen.set(false);
    if (except !== 'about') this.isAboutSubmenuOpen.set(false);
    if (except !== 'products') this.isProductsSubmenuOpen.set(false);
    if (except !== 'publications') this.isPublicationsSubmenuOpen.set(false);
    if (except !== 'contact') this.isContactSubmenuOpen.set(false);
    if (except !== 'header') this.isHeaderSubmenuOpen.set(false);
    if (except !== 'statistics') this.isStatisticsSubmenuOpen.set(false);
    if (except !== 'users') this.isUsersSubmenuOpen.set(false);
    if (except !== 'chatbot') this.isChatbotSubmenuOpen.set(false);
  }

  onNavItemClick(parent: string | null) {
    if (parent) {
      this.closeOtherSubmenus(parent);
    } else {
      this.closeOtherSubmenus(null);
    }
    this.mobileMenuOpen.set(false);
  }

  private loadUserData(): void {
    try {
      const possibleKeys = [
        'userData',
        'user',
        'authUser',
        'currentUser',
        'token',
        'authToken',
      ];
      let rawData: string | null = null;
      for (const key of possibleKeys) {
        const data = isPlatformBrowser(this.platformId)
          ? localStorage.getItem(key)
          : null;
        if (data) {
          rawData = data;
          break;
        }
      }
      if (!rawData && isPlatformBrowser(this.platformId)) {
        const extras = [
          'session',
          'userSession',
          'wep_session',
          'sessionClient',
        ];
        for (const k of extras) {
          const d = localStorage.getItem(k);
          if (d) {
            rawData = d;
            break;
          }
        }
      }

      if (rawData) {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && typeof parsed === 'object') {
            if ('user' in parsed && parsed.user) {
              this.userData.set(parsed.user);
            } else {
              this.userData.set(parsed);
            }
          } else {
            this.userData.set(parsed);
          }
        } catch (e) {
          this.userData.set(rawData);
        }
      } else {
        this.userData.set(null);
      }

      const currentData = this.userData();
      if (currentData && typeof currentData === 'object') {
        if (!('client' in currentData)) {
          const clientFromStorage = this.getClientFromLocalStorage();
          if (clientFromStorage) {
            try {
              currentData.client = clientFromStorage;
              this.userData.set({ ...currentData });
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      this.userData.set(null);
    }
  }

  getUserClient(): string {
    return this.userClient();
  }

  logout() {
    this.authSrv.logout();
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

  private initShowUsersMenu(): void {
    const clientFromInput = this.sessionClient();
    if (clientFromInput !== undefined && clientFromInput !== null) {
      this.showUsersMenu.set(this.isClientAllowed(clientFromInput));
      this.showBackupButtons.set(this.isClientAllowed(clientFromInput));
      return;
    }

    const clientFromStorage = this.getClientFromLocalStorage();
    if (clientFromStorage !== null) {
      this.showUsersMenu.set(this.isClientAllowed(clientFromStorage));
      this.showBackupButtons.set(this.isClientAllowed(clientFromStorage));
      return;
    }
    this.showUsersMenu.set(true);
    this.showBackupButtons.set(false);
  }

  private isClientAllowed(clientValue: string | undefined | null): boolean {
    if (!clientValue && clientValue !== '') {
      return true;
    }
    return clientValue === 'shirkasoft';
  }

  private getClientFromLocalStorage(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const candidateKeys = [
      'session',
      'user',
      'userSession',
      'auth',
      'currentUser',
      'wep_session',
      'sessionClient',
      'client',
    ];
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if ('client' in parsed && parsed.client) return parsed.client;
          if ('session' in parsed && parsed.session && parsed.session.client)
            return parsed.session.client;
          if ('user' in parsed && parsed.user && parsed.user.client)
            return parsed.user.client;
        }
        if (typeof parsed === 'string' && parsed.trim().length > 0) {
          return parsed;
        }
      } catch (e) {
        if (raw && raw.trim().length > 0) return raw;
      }
    }
    return null;
  }

  private startTitleAnimation(): void {
    // Limpiar cualquier intervalo o timeout existente
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = undefined;
    }

    // Esperar a que Transloco cargue la traducción
    const fullTitle = this.transloco.translate('navbar.title');

    // Si la traducción aún no está cargada, esperar un poco
    if (fullTitle === 'navbar.title') {
      setTimeout(() => this.startTitleAnimation(), 100);
      return;
    }

    // Resetear el título inmediatamente al cambiar de idioma
    this.animatedTitle.set('');

    const animateTitle = () => {
      const title = this.transloco.translate('navbar.title');
      let currentIndex = 0;

      this.animationInterval = setInterval(() => {
        if (currentIndex <= title.length) {
          this.animatedTitle.set(title.substring(0, currentIndex));
          currentIndex++;
        } else {
          if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = undefined;
          }
          // Mantener el título completo por 5 segundos antes de reiniciar
          this.animationInterval = setTimeout(() => {
            animateTitle();
          }, 5000) as any;
        }
      }, 100); // 100ms entre cada letra
    };

    animateTitle();
  }

  ngOnDestroy(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
  }
}
