import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
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
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';
import { CreateEditChatbotModelComponent } from '../create-edit-chatbot-model/create-edit-chatbot-model.component';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-chatbot-model',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-chatbot-model.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListChatbotModelComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private confirmDialogService = inject(ConfirmDialogService);
  private srv = inject(ChatbotService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_model.list.table.name'),
    { initialValue: '' }
  );
  private providerTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_model.list.table.provider'),
    { initialValue: '' }
  );
  private tokenLimitTranslation = toSignal(
    this.transloco.selectTranslate('components.chatbot_model.list.table.daily_token_limit'),
    { initialValue: '' }
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    return [
      {
        field: 'name',
        header: this.nameTranslation(),
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
        field: 'daily_token_limit',
        header: this.tokenLimitTranslation(),
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
    ];
  });

  // Computed para traducciones de confirmación (opcional pero recomendado)
  private deleteTranslations = computed(() => ({
    title: this.transloco.translate('components.news.delete.title'),
    message: this.transloco.translate('components.news.delete.message'),
    confirm: this.transloco.translate('components.news.delete.confirm'),
    cancel: this.transloco.translate('components.news.delete.cancel'),
  }));

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.srv
      .getModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: HomeData[]) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.chatbot_model.error.load'),
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
      'components.chatbot_model.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditChatbotModelComponent,
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
      'components.chatbot_model.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditChatbotModelComponent,
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
        .deleteModel(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadData();
            this.notificationSrv.addNotification(
              this.transloco.translate('notifications.news.success.deleted'),
              'success'
            );
          },
          error: (error) => {
            this.handleDeleteError(error);
          },
        });
    }
  }

  private handleDeleteError(error: any): void {
    let message = '';

    if (error.status === 400) {
      const detail = error.error?.detail || '';
      if (detail.includes('Cannot delete model')) {
        message = this.transloco.translate(
          'notifications.chatbot_model.error.cannotDelete'
        );
      } else {
        message = detail;
      }
    } else if (error.status === 404) {
      message = this.transloco.translate(
        'notifications.chatbot_model.error.notFound'
      );
    } else {
      message = this.transloco.translate(
        'notifications.chatbot_model.error.delete'
      );
    }

    this.notificationSrv.addNotification(message, 'error');
    this.loading.set(false);
  }
}
