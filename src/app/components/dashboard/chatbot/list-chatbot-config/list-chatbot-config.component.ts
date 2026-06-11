import {
  Component,
  inject,
  signal,
  computed,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../../../../shared/components/app-table/app.table.component';
import { ButtonModule } from 'primeng/button';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';
import {
  ModalService,
  ModalConfig,
} from '../../../../shared/services/system/modal.service';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { icons } from '../../../../core/constants/icons.constant';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CreateEditChatbotConfigComponent } from '../create-chatbot-config/create-edit-chatbot-config.component';

@Component({
  selector: 'app-list-chatbot-config',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-chatbot-config.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListChatbotConfigComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(ChatbotService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);

  // Signals reactivos para traducciones de estado
  private activeStatus = toSignal(
    this.transloco.selectTranslate('status.active'),
    { initialValue: '' }
  );
  private inactiveStatus = toSignal(
    this.transloco.selectTranslate('status.inactive'),
    { initialValue: '' }
  );

  // Signals reactivos para traducciones de columnas
  private userNameTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_config.list.table.name'),
    { initialValue: '' }
  );
  private modelNameTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_config.list.table.model'),
    { initialValue: '' }
  );
  private providerTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_config.list.table.provider'),
    { initialValue: '' }
  );
  private tokensRemainingTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_config.list.table.tokens_remaining'),
    { initialValue: '' }
  );
  private tokensLimitTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_config.list.table.tokens_limit'),
    { initialValue: '' }
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    return [
      {
        field: 'user_name',
        header: this.userNameTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'model_name',
        header: this.modelNameTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'provider',
        header: this.providerTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'tokens_remaining',
        header: this.tokensRemainingTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'tokens_limit',
        header: this.tokensLimitTranslation(),
        sortable: true,
        filter: true,
      },
    ];
  });

  // Signals reactivos para traducciones de acciones
  private createTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.create'),
    { initialValue: '' }
  );
  private editTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.edit'),
    { initialValue: '' }
  );
  private deleteTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.delete'),
    { initialValue: '' }
  );
  private enableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.enable'),
    { initialValue: '' }
  );
  private disableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.disable'),
    { initialValue: '' }
  );

  headerActions = computed<TableAction[]>(() => {
    return [
      {
        label: this.createTranslation(),
        icon: icons['add'],
        onClick: () => this.create(),
        class: 'p-button-primary',
      },
    ];
  });

  rowActions = computed<RowAction[]>(() => {
    return [
      {
        label: this.editTranslation(),
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
      },
      {
        label: this.deleteTranslation(),
        icon: icons['delete'],
        onClick: (data) => this.delete(data),
        class: buttonVariants.outline.red,
      },
      {
        label: (data) => (data.status ? this.disableTranslation() : this.enableTranslation()),
        icon: (data) => (data.status ? icons['activate'] : icons['deactivate']),
        onClick: (data) => this.toggleStatus(data),
        class: (data) =>
          data.status
            ? buttonVariants.outline.gray
            : buttonVariants.outline.neutral,
      },
    ];
  });

  // Computed para traducciones del diálogo de eliminación
  private deleteTranslations = computed(() => ({
    title: this.transloco.translate('components.chatbot_config.delete.title'),
    message: this.transloco.translate(
      'components.chatbot_config.delete.message'
    ),
    confirm: this.transloco.translate(
      'components.chatbot_config.delete.confirm'
    ),
    cancel: this.transloco.translate('components.chatbot_config.delete.cancel'),
  }));

  constructor() {
    // Cargar datos iniciales
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    this.srv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: HomeData[]) => {
          const active = this.activeStatus().trim();
          const inactive = this.inactiveStatus().trim();

          const processedData = data.map((item: any) => {
            const models = item.models || [];
            const providersList = models.map((m: any) => m.provider).join(', ');
            const totalTokens = models.reduce((sum: number, m: any) => sum + (m.tokens_remaining || 0), 0);
            return {
              ...item,
              user_name: item.user?.full_name,
              provider: providersList || 'N/A',
              tokens_remaining: totalTokens,
              tokens_limit: models.reduce((sum: number, m: any) => sum + (m.tokens_limit || 0), 0),
              statusToShow: item.status ? active : inactive,
            };
          });

          this.data.set(processedData);
          this.loading.set(false);
        },
        error: () => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.chatbot_config.error.load'),
            'error'
          );
          this.loading.set(false);
        },
      });
  }

  onRefresh(): void {
    this.loadData();
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.chatbot_config.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditChatbotConfigComponent,
      data: {
        initialData: {
          onSave: () => {
            this.loadData();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  edit(data: any): void {
    const translatedTitle = this.transloco.translate(
      'components.chatbot_config.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditChatbotConfigComponent,
      data: {
        initialData: {
          ...data,
          onSave: () => {
            this.loadData();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  async delete(data: any): Promise<void> {
    const translations = this.deleteTranslations();

    const confirmed = await this.confirmDialogService.confirm({
      title: translations.title,
      message: translations.message,
      confirmLabel: translations.confirm,
      cancelLabel: translations.cancel,
    });

    if (confirmed) {
      this.loading.set(true);
      this.srv
        .delete(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadData();
            this.notificationSrv.addNotification(
              this.transloco.translate(
                'notifications.chatbot_config.success.deleted'
              ),
              'success'
            );
          },
          error: (error) => {
            if (
              error.error?.statusCode === 400 &&
              error.error?.message?.includes('Cannot delete')
            ) {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.chatbot_config.error.cannotDelete'
                ),
                'error'
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.chatbot_config.error.delete'
                ),
                'error'
              );
            }
            this.loading.set(false);
          },
        });
    }
  }

  toggleStatus(data: any): void {
    const currentData = this.data();
    const newStatus = !data.status;

    this.srv
      .patch({ status: newStatus }, data.user_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const active = this.activeStatus().trim();
          const inactive = this.inactiveStatus().trim();

          // Actualizar estado local inmutablemente
          const updatedData = currentData.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  status: newStatus,
                  statusToShow: newStatus ? active : inactive,
                }
              : item
          );

          this.data.set(updatedData);

          const statusText = newStatus ? active : inactive;
          const message = this.transloco.translate(
            'notifications.chatbot_config.success.statusUpdated',
            { status: statusText }
          );
          this.notificationSrv.addNotification(message, 'success');
        },
        error: (error) => {
          if (error?.error?.message && error.error?.statusCode === 400) {
            this.notificationSrv.addNotification(error.error.message, 'error');
          } else {
            const message = this.transloco.translate(
              'notifications.chatbot_config.error.statusUpdate'
            );
            this.notificationSrv.addNotification(message, 'error');
          }
        },
      });
  }
}
