import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NotificationService,
  Notification,
} from '../../services/system/notification.service';
import { LucideDynamicIcon } from '@lucide/angular';
import { getLucideIcon } from '../../../core/constants/icons.constant';

@Component({
  selector: 'app-notification',
  templateUrl: './app-notification.component.html',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent {
  private notificationService = inject(NotificationService);
  protected getIcon = getLucideIcon;

  private readonly iconMap: Record<string, string> = {
    success: 'check',
    error: 'circle-x',
    info: 'info',
    warning: 'triangle-alert',
  };

  getNotificationIcon(type: string): string {
    return this.iconMap[type] || 'info';
  }

  // Usar la señal directamente del servicio
  notifications = this.notificationService.notifications;

  // Computed signal para notificaciones ordenadas (opcional)
  sortedNotifications = computed(
    () => [...this.notifications()].reverse(), // Mostrar las más recientes primero
  );

  removeNotification(notification: Notification): void {
    this.notificationService.removeNotification(notification);
  }

  roundProgress(progress: number | undefined): number {
    return Math.round(progress || 0);
  }

  // Computed signal para determinar si hay notificaciones
  hasNotifications = computed(() => this.notifications().length > 0);
}
