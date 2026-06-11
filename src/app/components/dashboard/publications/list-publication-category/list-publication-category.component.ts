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
import { CreateEditPublicationCategoryComponent } from '../create-edit-publication-category/create-edit-publication-category.component';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-publication-category',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-publication-category.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPublicationCategoryComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(PublicationCategoryService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.publication-category.list.table.name'
    ),
    { initialValue: '' }
  );

  // Computed signals para traducciones
  columns = computed<Column[]>(() => {
    return [
      {
        field: 'title',
        header: this.nameTranslation(),
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

  // Computed para traducciones del diálogo de eliminación
  private deleteTranslations = computed(() => ({
    title: this.transloco.translate(
      'components.publication-category.delete.title'
    ),
    message: this.transloco.translate(
      'components.publication-category.delete.message'
    ),
    confirm: this.transloco.translate(
      'components.publication-category.delete.confirm'
    ),
    cancel: this.transloco.translate(
      'components.publication-category.delete.cancel'
    ),
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
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.publication-category.error.load'
            ),
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
      'components.publication-category.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditPublicationCategoryComponent,
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
      'components.publication-category.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditPublicationCategoryComponent,
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
                'notifications.publication-category.success.deleted'
              ),
              'success'
            );
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes('No se puede eliminar la categoría')
            ) {
              this.notificationSrv.addNotification(
                error.error.message,
                'error'
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.publication-category.error.delete'
                ),
                'error'
              );
            }
            this.loading.set(false);
          },
        });
    }
  }
}
