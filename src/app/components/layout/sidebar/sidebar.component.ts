import {
  Component,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  HostListener,
  Inject,
  Input,
  PLATFORM_ID,
  signal,
  computed,
  effect,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { CollapsedService } from '../../../shared/services/system/collapsed.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { filter } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  SidebarMenuItemComponent,
  MenuItem,
} from './sidebar-menu-item.component';
import { TooltipModule } from 'primeng/tooltip';
import { getLucideIcon, icons } from '../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    TranslocoModule,
    SidebarMenuItemComponent,
    TooltipModule,
    LucideDynamicIcon,
  ],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit, OnDestroy, OnChanges {
  private collapsedService = inject(CollapsedService);
  public router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  @Input() sessionClient?: string;

  // Signals
  sidebarCollapsed = signal(false);
  isMobileView = signal(false);
  showSidebar = signal(true);
  currentRouteTitle = signal('');
  showUsersMenu = signal(true);
  menuItems = signal<MenuItem[]>([]);

  // Método para obtener iconos
  readonly getIcon = getLucideIcon;
  readonly icons = icons;

  // Computed
  collapsedWidth = computed(() => this.collapsedService.getCollapsedWidth());
  expandedWidth = computed(() => this.collapsedService.getExpandedWidth());

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    if (isPlatformBrowser(platformId)) {
      this.checkScreenSize();
    }

    // Effect para sincronizar el estado del sidebar
    effect(() => {
      const collapsed = this.collapsedService.sidebarCollapsed();
      this.sidebarCollapsed.set(collapsed);
      this.cdr.markForCheck();
    });

    // Effect para sincronizar el estado móvil
    effect(() => {
      const isMobile = this.collapsedService.isMobile();
      this.isMobileView.set(isMobile);
      this.showSidebar.set(!isMobile);
    });

    // Effect para sincronizar cambios de ruta
    effect(() => {
      const subscription = this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          this.updateRouteTitle();
        });

      return () => subscription.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.initializeMenuItems();

    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
      this.updateRouteTitle();
    }

    this.initShowUsersMenu();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionClient'] && !changes['sessionClient'].isFirstChange()) {
      this.initShowUsersMenu();
    }
  }

  ngOnDestroy(): void {
    // Ya no necesitamos destruir subscription ya que usamos effects
  }

  private initializeMenuItems(): void {
    this.menuItems.set([
      {
        label: 'sidebar.admin',
        icon: 'settings',
        route: ['/admin'],
      },
      {
        label: 'sidebar.statistics',
        icon: 'bar-chart',
        children: [
          {
            label: 'sidebar.statistics_charts',
            icon: 'line-chart',
            route: ['/statistics'],
          },
          {
            label: 'sidebar.statistics_config',
            icon: 'settings',
            route: ['/statistics-config'],
          },
        ],
      },
      {
        label: 'sidebar.header',
        icon: 'grip-horizontal',
        children: [
          {
            label: 'sidebar.header_info',
            icon: 'pencil-ruler',
            route: ['/header'],
          },
        ],
      },
      {
        label: 'sidebar.home',
        icon: 'home',
        children: [
          {
            label: 'sidebar.carousel',
            icon: 'images',
            route: ['/carousel'],
          },
          {
            label: 'sidebar.news',
            icon: 'newspaper',
            route: ['/news'],
          },
        ],
      },
      {
        label: 'sidebar.about',
        icon: 'warehouse',
        children: [
          {
            label: 'sidebar.company',
            icon: 'building',
            route: ['/company'],
          },
          {
            label: 'sidebar.manager-category',
            icon: 'list',
            route: ['/manager-category'],
          },
          {
            label: 'sidebar.manager',
            icon: 'user-star',
            route: ['/managers'],
          },
          {
            label: 'sidebar.review',
            icon: 'pen-square',
            route: ['/reviews'],
          },
        ],
      },
      {
        label: 'sidebar.products',
        icon: 'shopping-cart',
        children: [
          {
            label: 'sidebar.category',
            icon: 'list',
            route: ['/categories'],
          },
          {
            label: 'sidebar.offers',
            icon: 'shopping-basket',
            route: ['/products'],
          },
        ],
      },
      {
        label: 'sidebar.publications',
        icon: 'book-open-text',
        children: [
          {
            label: 'sidebar.publications-category',
            icon: 'list',
            route: ['/publication-category'],
          },
          {
            label: 'sidebar.manage-publications',
            icon: 'book-open-check',
            route: ['/publications'],
          },
        ],
      },
      {
        label: 'sidebar.contact',
        icon: 'headset',
        children: [
          {
            label: 'sidebar.info',
            icon: 'info',
            route: ['/contact'],
          },
        ],
      },
      {
        label: 'sidebar.users',
        icon: 'users',
        children: [
          {
            label: 'sidebar.users_manage',
            icon: 'user-cog',
            route: ['/users'],
          },
        ],
      },
      {
        label: 'sidebar.chatbot',
        icon: 'bot',
        children: [
          {
            label: 'sidebar.chatbot_models',
            icon: 'brain-circuit',
            route: ['/chatbot-models'],
          },
          {
            label: 'sidebar.chatbot_config',
            icon: 'settings',
            route: ['/chatbot-config'],
          },
        ],
      },
    ]);
  }

  toggleSidebar(): void {
    if (this.isMobileView()) {
      this.showSidebar.update((v) => !v);
    } else {
      this.collapsedService.toggleSidebar();
    }
  }

  @HostListener('window:resize', [])
  onResize() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  private checkScreenSize(): void {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 768;
      this.isMobileView.set(isMobile);

      if (isMobile) {
        this.sidebarCollapsed.set(true);
        this.collapsedService.setSidebarState(true);
        this.showSidebar.set(false);
      } else {
        this.showSidebar.set(true);
      }
    }
  }

  closeMobileSidebar(): void {
    if (this.isMobileView()) {
      this.showSidebar.set(false);
    }
  }

  private updateRouteTitle(): void {
    const routePath = this.router.url;

    // Update menu items isOpen state without triggering signal update if not needed
    const items = this.menuItems();
    let hasChanges = false;

    items.forEach((item) => {
      if (item.children) {
        const shouldBeOpen = item.children.some(
          (child) => child.route && routePath.includes(child.route[0]),
        );
        if (item.isOpen !== shouldBeOpen) {
          item.isOpen = shouldBeOpen;
          hasChanges = true;
        }
      }
    });

    // Only update signal if there were actual changes
    if (hasChanges) {
      this.menuItems.set([...items]);
    }

    // Set title
    const titleMap: Record<string, string> = {
      '/admin': 'Administración',
      '/statistics': 'Estadísticas - Gráficas',
      '/statistics-config': 'Estadísticas - Configuración',
      '/header': 'Encabezado',
      '/carousel': 'Inicio - Carrusel',
      '/news': 'Inicio - Novedades',
      '/users': 'Usuarios',
      '/categories': 'Categorías',
      '/products': 'Ofertas',
      '/publication-category': 'Categorías de Publicaciones',
      '/publications': 'Publicaciones',
      '/chatbot-models': 'Modelos de IA',
      '/chatbot-config': 'Configuración de Chatbot',
    };

    const title = Object.keys(titleMap).find((key) => routePath.includes(key));
    const newTitle = title ? titleMap[title] : '';

    // Only update if title actually changed
    if (this.currentRouteTitle() !== newTitle) {
      this.currentRouteTitle.set(newTitle);
    }
  }

  private initShowUsersMenu(): void {
    const clientFromInput = this.sessionClient;
    if (clientFromInput !== undefined && clientFromInput !== null) {
      this.showUsersMenu.set(this.isClientAllowed(clientFromInput));
      return;
    }

    const clientFromStorage = this.getClientFromLocalStorage();
    if (clientFromStorage !== null) {
      this.showUsersMenu.set(this.isClientAllowed(clientFromStorage));
      return;
    }
    this.showUsersMenu.set(true);
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
    ];

    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'client' in parsed) {
          return parsed['client'];
        }
        if (typeof parsed === 'string') {
          return parsed;
        }
      } catch (e) {
        if (typeof raw === 'string' && raw.trim().length > 0) {
          return raw;
        }
      }
    }

    const direct = localStorage.getItem('sessionClient');
    if (direct) return direct;

    return null;
  }

  // Método helper para filtrar menús según permisos
  visibleMenuItems = computed(() => {
    const items = this.menuItems();
    const showUsers = this.showUsersMenu();

    // Filtrar items que requieren permisos especiales
    return items
      .filter((item) => {
        // Si es el menú de usuarios o chatbot, verificar permisos
        if (
          item.label === 'sidebar.users' ||
          item.label === 'sidebar.chatbot'
        ) {
          return showUsers;
        }
        return true;
      })
      .map((item) => {
        // Filtrar submenús que requieren permisos especiales
        if (item.children && item.label === 'sidebar.statistics') {
          return {
            ...item,
            children: item.children.filter((child) => {
              // Filtrar configuración de estadísticas solo para shirkasoft
              if (child.label === 'sidebar.statistics_config') {
                return showUsers;
              }
              return true;
            }),
          };
        }
        return item;
      });
  });
}
