import {
  Injectable,
  Inject,
  PLATFORM_ID,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class CollapsedService {
  private sidebarCollapsedSignal = signal<boolean>(false);
  public sidebarCollapsed = computed(() => this.sidebarCollapsedSignal());

  private collapsedWidth = 'w-20';
  private expandedWidth = 'w-64';

  // Propiedades para pantallas móviles
  private isMobileSignal = signal<boolean>(false);
  public isMobile = computed(() => this.isMobileSignal());

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Solo ejecutar código relacionado con window si estamos en el navegador
    if (isPlatformBrowser(this.platformId)) {
      // Comprobar el tamaño de la pantalla al iniciar
      this.checkScreenSize();

      // Agregar un listener para cambios de tamaño de pantalla
      window.addEventListener('resize', () => this.checkScreenSize());
    }
  }

  private checkScreenSize(): void {
    // Solo ejecutar si estamos en el navegador
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 750;
      this.isMobileSignal.set(isMobile);

      // Si cambia a móvil, colapsar automáticamente
      if (isMobile && !this.sidebarCollapsedSignal()) {
        this.sidebarCollapsedSignal.set(true);
      }
    }
  }

  toggleSidebar(): void {
    // Solo permitir alternar si no está en modo móvil o forzar colapso en móvil
    if (this.isMobileSignal()) {
      // En móvil, siempre colapsar
      this.sidebarCollapsedSignal.set(true);
    } else {
      // En escritorio, toggle normal
      this.sidebarCollapsedSignal.update((state) => !state);
    }
  }

  getSidebarState(): boolean {
    return this.sidebarCollapsedSignal();
  }

  setSidebarState(state: boolean): void {
    this.sidebarCollapsedSignal.set(state);
  }

  getCollapsedWidth(): string {
    return this.collapsedWidth;
  }

  getExpandedWidth(): string {
    return this.expandedWidth;
  }

  setMobileState(isMobile: boolean): void {
    this.isMobileSignal.set(isMobile);

    // Si cambia a móvil, forzar el colapso del sidebar
    if (isMobile) {
      this.sidebarCollapsedSignal.set(true);
    }
  }

  getMobileState(): boolean {
    return this.isMobileSignal();
  }
}
