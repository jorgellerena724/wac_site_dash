import {
  Component,
  inject,
  signal,
  computed,
  TemplateRef,
  viewChild,
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
import { PublicationData } from '../../../../shared/interfaces/publications.interface';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { PublicationsService } from '../../../../shared/services/features/publications.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CreateEditPublicationComponent } from '../create-edit-publication/create-edit-publication.component';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-publications',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-publications.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPublicationComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(PublicationsService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // ViewChild signals
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: TemplateRef<any> }>(() => {
    const imgTemplate = this.imageTemplate();
    const templates: { [key: string]: TemplateRef<any> } = {};

    if (imgTemplate) {
      templates['firstImage'] = imgTemplate;
    }

    return templates;
  });

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.publications.list.table.name'),
    { initialValue: '' },
  );
  private categoryTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.publications.list.table.category',
    ),
    { initialValue: '' },
  );
  private imageTranslation = toSignal(
    this.transloco.selectTranslate('components.publications.list.table.image'),
    { initialValue: '' },
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
      {
        field: 'categoryName',
        header: this.categoryTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'firstImage',
        header: this.imageTranslation(),
        width: '240px',
      },
    ];
  });

  // Signals reactivos para traducciones de acciones
  private createTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.create'),
    { initialValue: '' },
  );
  private editTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.edit'),
    { initialValue: '' },
  );
  private deleteTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.delete'),
    { initialValue: '' },
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
    title: this.transloco.translate('components.publications.delete.title'),
    message: this.transloco.translate('components.publications.delete.message'),
    confirm: this.transloco.translate('components.publications.delete.confirm'),
    cancel: this.transloco.translate('components.publications.delete.cancel'),
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
        next: (data: PublicationData[]) => {
          const processedData = data.map((item: any) => ({
            ...item,
            categoryName: item.publication_category.title,
          }));

          this.data.set(processedData);
          this.loading.set(false);

          // Cargar las imágenes de las publicaciones
          this.loadPublicationImages(processedData);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.publications.error.load'),
            'error',
          );
          this.loading.set(false);
        },
      });
  }

  private loadPublicationImages(publications: any[]): void {
    publications.forEach((item) => {
      if (item.photo) {
        this.srv
          .getImage(item.photo)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (imageBlob) => {
              const url = URL.createObjectURL(imageBlob);
              this.imageUrls.update((urls) => ({ ...urls, [item.id]: url }));
            },
            error: (error) => {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.managers.error.loadImage',
                ),
                'error',
              );
            },
          });
      }
    });
  }

  onRefresh(): void {
    this.cleanupBlobUrls();
    this.imageUrls.set({});
    this.loadData();
  }

  getImageUrl(rowData: any): string {
    return this.imageUrls()[rowData.id] || '';
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.publications.create.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditPublicationComponent,
      showExpandButton: true,
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
      'components.publications.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditPublicationComponent,
      showExpandButton: true,
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

  onImageError(event: any): void {
    event.target.style.display = 'none';
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
                'notifications.publications.success.deleted',
              ),
              'success',
            );
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes(
                'No se puede eliminar la publicación',
              )
            ) {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.publications.error.cannotDelete',
                ),
                'error',
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.publications.error.delete',
                ),
                'error',
              );
            }
            this.loading.set(false);
          },
        });
    }
  }

  private cleanupBlobUrls(): void {
    const images = this.imageUrls();
    Object.values(images).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }
}
