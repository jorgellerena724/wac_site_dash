import {
  Component,
  HostListener,
  PLATFORM_ID,
  DestroyRef,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Router,
  NavigationEnd,
  RouterOutlet,
  ActivatedRoute,
} from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { filter, map, mergeMap } from 'rxjs/operators';
import { ModalComponent } from './shared/components/app-modal/app-modal.component';
import { NotificationComponent } from './shared/components/app-notification/app-notification.component';
import { ModalService } from './shared/services/system/modal.service';
import { SidebarComponent } from '../app/components/layout/sidebar/sidebar.component';
import { FooterComponent } from '../app/components/layout/footer/footer.component';
import { CollapsedService } from '../app/shared/services/system/collapsed.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    ModalComponent,
    NotificationComponent,
    SidebarComponent,
    FooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // Inyección de servicios
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private collapsedService = inject(CollapsedService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  // Signals para estado
  showLayout = signal<boolean>(true);
  isCollapsed = signal<boolean>(false);
  isMobile = signal<boolean>(false);

  // Computed para clases dinámicas
  mainClasses = computed(() => {
    if (this.isMobile()) {
      return 'ml-0';
    } else if (this.isCollapsed()) {
      return 'ml-20';
    } else {
      return 'ml-64';
    }
  });

  footerClasses = computed(() => {
    if (this.isMobile()) {
      return 'ml-0';
    } else if (this.isCollapsed()) {
      return 'ml-20';
    } else {
      return 'ml-64';
    }
  });

  constructor() {
    // Effect para manejar cambios de ruta y showLayout
    effect(() => {
      const subscription = this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          map(() => {
            let route = this.activatedRoute;
            while (route.firstChild) {
              route = route.firstChild;
            }
            return route;
          }),
          mergeMap((route) => route.data),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((data) => {
          this.showLayout.set(data['layout'] !== false);
        });

      return () => subscription.unsubscribe();
    });

    // Effect para cerrar modal en login
    effect(() => {
      const subscription = this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((event: NavigationEnd) => {
          if (event.url.includes('/login')) {
            this.modalService.close();
          }
        });

      return () => subscription.unsubscribe();
    });

    // Effect para suscribirse al estado del sidebar usando signals
    effect(() => {
      const collapsed = this.collapsedService.sidebarCollapsed();
      this.isCollapsed.set(collapsed);
    });

    // Effect para suscribirse al estado móvil usando signals
    effect(() => {
      const mobile = this.collapsedService.isMobile();
      this.isMobile.set(mobile);

      // Si cambia a móvil, asegurarse que el layout se ajusta correctamente
      if (mobile && this.showLayout()) {
        // Forzar el colapso del sidebar en móvil
        this.collapsedService.setSidebarState(true);
      }
    });

    // Inicializar tamaño de pantalla
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      const newIsMobile = window.innerWidth <= 768;

      // Actualizar el estado móvil solo si ha cambiado
      if (this.isMobile() !== newIsMobile) {
        this.isMobile.set(newIsMobile);
        this.collapsedService.setMobileState(this.isMobile());

        // En móvil, asegurarse de que el sidebar esté colapsado
        if (this.isMobile()) {
          this.collapsedService.setSidebarState(true);
        }
      }
    }
  }
}
