import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  progress?: number;
  showProgress?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  // Signal para las notificaciones
  private notificationsSignal = signal<Notification[]>([]);
  private currentId = 0;

  // Exponer señal de solo lectura
  notifications = this.notificationsSignal.asReadonly();

  addNotification(
    message: string,
    type: Notification['type'] = 'info',
    showProgress: boolean = false,
    duration: number = 5000
  ): string {
    const id = (++this.currentId).toString();
    const notification: Notification = {
      id,
      message,
      type,
      progress: showProgress ? 0 : undefined,
      showProgress,
    };

    // Agregar nueva notificación de forma inmutable
    this.notificationsSignal.update((notifications) => [
      ...notifications,
      notification,
    ]);

    // Auto-remover si tiene duración (usar setTimeout para no bloquear)
    if (duration > 0 && !showProgress) {
      setTimeout(() => this.removeNotificationById(id), duration);
    }

    return id;
  }

  updateProgress(notificationId: string, progress: number) {
    const currentNotifications = this.notificationsSignal();
    const index = currentNotifications.findIndex(
      (n) => n.id === notificationId
    );

    if (index > -1 && currentNotifications[index].showProgress) {
      const updatedProgress = Math.min(100, Math.max(0, progress));

      // Actualizar de forma inmutable
      this.notificationsSignal.update((notifications) =>
        notifications.map((n, i) =>
          i === index ? { ...n, progress: updatedProgress } : n
        )
      );

      // Auto-remover cuando llega al 100%
      if (progress >= 100) {
        setTimeout(() => this.removeNotificationById(notificationId), 2000);
      }
    }
  }

  removeNotification(notification: Notification): void {
    this.removeNotificationById(notification.id);
  }

  removeNotificationById(notificationId: string): void {
    this.notificationsSignal.update((notifications) =>
      notifications.filter((n) => n.id !== notificationId)
    );
  }

  clearAll(): void {
    this.notificationsSignal.set([]);
  }
}
