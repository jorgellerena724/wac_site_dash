import {
  Component,
  inject,
  signal,
  computed,
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
import { CreateEditCategoryComponent } from '../create-edit-category/create-edit-category.component';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { CategoryService } from '../../../../shared/services/features/category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-category',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-category.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListCategoryComponent {
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(CategoryService);
  private confirmDialogService = inject(ConfirmDialogService);

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.category.list.table.name'),
    { initialValue: '' }
  );

  // Computed signals para traducciones reactivas
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

  constructor() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.srv.get().subscribe({
      next: (data: HomeData[]) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.categories.error.load'),
          'error'
        );
        this.loading.set(false);
      },
    });
  }

  onRefresh() {
    this.loadData();
  }

  create() {
    const translatedTitle = this.transloco.translate(
      'components.category.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditCategoryComponent,
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

  edit(data: any) {
    const translatedTitle = this.transloco.translate(
      'components.category.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditCategoryComponent,
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

  async delete(data: any) {
    const titleTranslation = this.transloco.translate(
      'components.category.delete.title'
    );
    const messageTranslation = this.transloco.translate(
      'components.category.delete.message'
    );
    const confirmTranslation = this.transloco.translate(
      'components.category.delete.confirm'
    );
    const cancelTranslation = this.transloco.translate(
      'components.category.delete.cancel'
    );

    const confirmed = await this.confirmDialogService.confirm({
      title: titleTranslation,
      message: messageTranslation,
      confirmLabel: confirmTranslation,
      cancelLabel: cancelTranslation,
    });

    if (confirmed) {
      this.loading.set(true);
      this.srv.delete(data.id).subscribe({
        next: () => {
          this.loadData();
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.categories.success.deleted'
            ),
            'success'
          );
        },
        error: (error) => {
          if (
            error.status === 400 &&
            error.error.detail.includes(
              'No se puede eliminar la categoría porque tiene productos asociados.'
            )
          ) {
            this.notificationSrv.addNotification(
              this.transloco.translate(
                'notifications.categories.error.productAsociated'
              ),
              'error'
            );
          } else {
            this.notificationSrv.addNotification(
              this.transloco.translate('notifications.categories.error.delete'),
              'error'
            );
          }
          this.loading.set(false);
        },
      });
    }
  }
}
