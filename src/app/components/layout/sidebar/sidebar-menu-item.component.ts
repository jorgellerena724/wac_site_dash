import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { getLucideIcon } from '../../../core/constants/icons.constant';
import { NgComponentOutlet } from '@angular/common';

export interface MenuItem {
  label: string;
  icon: string;
  route?: string[];
  children?: MenuItem[];
  isOpen?: boolean;
}

@Component({
  selector: 'app-sidebar-menu-item',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslocoModule,
    NgComponentOutlet,
  ],
  template: `
    <div class="mb-2">
      <div
        (click)="toggleSubmenu()"
        [title]="sidebarCollapsed && !isMobileView ? label : ''"
        class="flex items-center p-2 rounded-lg border border-gray-600 hover:bg-gray-700 hover:text-white cursor-pointer relative group"
        [ngClass]="{
          'bg-gray-700 text-white': isOpen || isActive(),
        }"
      >
        <div
          class="flex items-center justify-center w-6 h-6"
          [ngClass]="{
            'w-full': sidebarCollapsed && !isMobileView,
          }"
        >
          <ng-container *ngComponentOutlet="getIcon(icon)" />
        </div>
        <span
          class="whitespace-nowrap transition-all duration-500 ease-in-out flex-1"
          [ngClass]="{
            'opacity-0 w-0 ml-0': sidebarCollapsed && !isMobileView,
            'opacity-100 w-auto ml-2': !sidebarCollapsed || isMobileView,
          }"
        >
          {{ label | transloco }}
        </span>
        @if ((!sidebarCollapsed || isMobileView) && children?.length) {
          <div
            class="transition-transform duration-300"
            [class.rotate-180]="isOpen"
          >
            <ng-container *ngComponentOutlet="getIcon('chevron-down')" />
          </div>
        }
      </div>

      @if (children?.length) {
        <div
          class="overflow-hidden transition-all duration-300 ease-in-out"
          [ngClass]="{
            'max-h-0 opacity-0': !isOpen || (sidebarCollapsed && !isMobileView),
            'max-h-96 opacity-100':
              isOpen && (!sidebarCollapsed || isMobileView),
          }"
        >
          <div class="ml-6 mt-1">
            @for (child of children; track child.label) {
              <div>
                <a
                  [routerLink]="child.route"
                  routerLinkActive="bg-gray-600 text-white"
                  (click)="closeMobileSidebar.emit()"
                  class="border border-gray-700 flex items-center p-2 mb-1 rounded-lg hover:bg-gray-600 hover:text-white text-sm"
                >
                  <div class="flex items-center justify-center w-5 h-5">
                    <ng-container *ngComponentOutlet="getIcon(child.icon)" />
                  </div>
                  <span class="ml-2">{{ child.label | transloco }}</span>
                </a>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class SidebarMenuItemComponent implements OnInit {
  @Input() item!: MenuItem;
  @Input() sidebarCollapsed = false;
  @Input() isMobileView = false;
  @Input() router!: Router;

  @Output() closeMobileSidebar = new EventEmitter<void>();

  label = '';
  icon = '';
  children?: MenuItem[];
  isOpen = false;

  // Método para obtener iconos
  readonly getIcon = getLucideIcon;

  ngOnInit() {
    this.label = this.item.label;
    this.icon = this.item.icon;
    this.children = this.item.children;
    this.isOpen = this.item.isOpen || false;
  }

  toggleSubmenu(): void {
    if (this.children?.length) {
      this.isOpen = !this.isOpen;
    } else if (this.item.route) {
      this.router.navigate(this.item.route);
      this.closeMobileSidebar.emit();
    }
  }

  isActive(): boolean {
    if (!this.children?.length && this.item.route) {
      return this.router.url.includes(this.item.route[0]);
    }
    return (
      this.children?.some(
        (child) => child.route && this.router.url.includes(child.route[0]),
      ) || false
    );
  }
}
