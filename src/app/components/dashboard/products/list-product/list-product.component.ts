import {
  Component,
  inject,
  signal,
  computed,
  effect,
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
import {
  icons,
  getLucideIcon,
} from '../../../../core/constants/icons.constant';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { CreateEditProductComponent } from '../create-edit-product/create-edit-product.component';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { ProductService } from '../../../../shared/services/features/product.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-list-product',
  imports: [TableComponent, ButtonModule, TranslocoModule, LucideDynamicIcon],
  templateUrl: './list-product.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListProductComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(ProductService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // ViewChild signals
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');
  variantsTemplate = viewChild<TemplateRef<any>>('variantsTemplate');

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});
  videoUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: any }>(() => {
    const imgTemplate = this.imageTemplate();
    const varTemplate = this.variantsTemplate();
    const templates: { [key: string]: any } = {};

    if (imgTemplate) templates['firstImage'] = imgTemplate;
    if (varTemplate) templates['variants'] = varTemplate;

    return templates;
  });

  // Signals reactivos para traducciones de estado
  private activeStatus = toSignal(
    this.transloco.selectTranslate('status.active'),
    { initialValue: '' },
  );
  private inactiveStatus = toSignal(
    this.transloco.selectTranslate('status.inactive'),
    { initialValue: '' },
  );

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.products.list.table.name'),
    { initialValue: '' },
  );
  private variantsTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.products.list.table.variants.title',
    ),
    { initialValue: '' },
  );
  private descriptionTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.products.list.table.description',
    ),
    { initialValue: '' },
  );
  private categoryTranslation = toSignal(
    this.transloco.selectTranslate('components.products.list.table.category'),
    { initialValue: '' },
  );
  private imageTranslation = toSignal(
    this.transloco.selectTranslate('components.products.list.table.image'),
    { initialValue: '' },
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
      {
        field: 'variants',
        header: this.variantsTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'description',
        header: this.descriptionTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'categoryName',
        header: this.categoryTranslation(),
        sortable: true,
        filter: true,
      },
      { field: 'firstImage', header: this.imageTranslation(), width: '240px' },
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
  private enableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.enable'),
    { initialValue: '' },
  );
  private disableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.disable'),
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
      {
        label: (data) =>
          data.status ? this.disableTranslation() : this.enableTranslation(),
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
    title: this.transloco.translate('components.products.delete.title'),
    message: this.transloco.translate('components.products.delete.message'),
    confirm: this.transloco.translate('components.products.delete.confirm'),
    cancel: this.transloco.translate('components.products.delete.cancel'),
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
          const processedData = data.map((item: any) => {
            let variantsText = '';

            if (item.variants && Array.isArray(item.variants)) {
              variantsText = item.variants
                .map((v: any) => `${v.description}: ${v.price}$`)
                .join(', ');
            }

            // Obtener la primera imagen del array files
            const firstFile =
              item.files && item.files.length > 0 ? item.files[0] : null;
            const firstImagePath = firstFile ? firstFile.media : null;
            const isVideo = firstImagePath
              ? this.isVideoFile(firstImagePath)
              : false;

            return {
              ...item,
              categoryName: item.category.title,
              variantsText,
              firstImagePath,
              isVideo,
              firstFileTitle: firstFile ? firstFile.title : '',
            };
          });

          this.data.set(processedData);
          this.loading.set(false);

          // Cargar las imágenes/videos de los productos
          this.loadProductMedia(processedData);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.products.error.load'),
            'error',
          );
          this.loading.set(false);
        },
      });
  }

  private loadProductMedia(products: any[]): void {
    products.forEach((item) => {
      if (item.firstImagePath) {
        this.srv
          .getImage(item.firstImagePath)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (fileBlob) => {
              const url = URL.createObjectURL(fileBlob);

              if (item.isVideo) {
                this.videoUrls.update((urls) => ({ ...urls, [item.id]: url }));
              } else {
                this.imageUrls.update((urls) => ({ ...urls, [item.id]: url }));
              }
            },
            error: (error) => {
              console.error(
                `Error loading media for product ${item.id}:`,
                error,
              );
            },
          });
      }
    });
  }

  private isVideoFile(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension || '');
  }

  onRefresh(): void {
    this.cleanupBlobUrls();
    this.imageUrls.set({});
    this.videoUrls.set({});
    this.loadData();
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.products.create.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditProductComponent,
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
      'components.products.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditProductComponent,
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
                'notifications.products.success.deleted',
              ),
              'success',
            );
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes('No se puede eliminar el producto')
            ) {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.products.error.cannotDelete',
                ),
                'error',
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate('notifications.products.error.delete'),
                'error',
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
    const formData = new FormData();
    formData.append('id', data.id);
    formData.append('status', String(newStatus));

    this.srv
      .patch(formData, data.id)
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
              : item,
          );

          this.data.set(updatedData);

          const statusText = newStatus ? active : inactive;
          const message = this.transloco.translate(
            'notifications.news.success.statusUpdated',
            { status: statusText },
          );
          this.notificationSrv.addNotification(message, 'success');
        },
        error: (error) => {
          if (error?.error?.message && error.error?.statusCode === 400) {
            this.notificationSrv.addNotification(error.error.message, 'error');
          } else {
            const message = this.transloco.translate(
              'notifications.news.error.statusUpdate',
            );
            this.notificationSrv.addNotification(message, 'error');
          }
        },
      });
  }

  getImageUrl(rowData: any): string {
    return this.imageUrls()[rowData.id] || '';
  }

  getVideoUrl(rowData: any): string {
    return this.videoUrls()[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  private cleanupBlobUrls(): void {
    const images = this.imageUrls();
    const videos = this.videoUrls();

    Object.values(images).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });

    Object.values(videos).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}
