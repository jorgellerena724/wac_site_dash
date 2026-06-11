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
import { TooltipModule } from 'primeng/tooltip';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';
import {
  ModalService,
  ModalConfig,
} from '../../../../shared/services/system/modal.service';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { icons } from '../../../../core/constants/icons.constant';
import { NewsService } from '../../../../shared/services/features/news.service';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { CreateEditNewsComponent } from '../create-edit-news/create-edit-news.component';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-list-news',
  imports: [
    TableComponent,
    ButtonModule,
    TranslocoModule,
    TooltipModule,
    LucideDynamicIcon,
  ],
  templateUrl: './list-news.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListNewsComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(NewsService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // ViewChild signals
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');
  orderTemplate = viewChild<TemplateRef<any>>('orderTemplate');

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});
  videoUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: any }>(() => {
    const imgTemplate = this.imageTemplate();
    const ordTemplate = this.orderTemplate();
    const templates: { [key: string]: any } = {};

    if (imgTemplate) templates['image'] = imgTemplate;
    if (ordTemplate) templates['order'] = ordTemplate;

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
  private orderTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.order'),
    { initialValue: '' },
  );
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.name'),
    { initialValue: '' },
  );
  private descriptionTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.description'),
    { initialValue: '' },
  );
  private dateTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.date'),
    { initialValue: '' },
  );
  private statusTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.status'),
    { initialValue: '' },
  );
  private imageTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.image'),
    { initialValue: '' },
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    return [
      { field: 'order', header: this.orderTranslation(), width: '80px' },
      {
        field: 'title',
        header: this.nameTranslation(),
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
        field: 'fecha',
        header: this.dateTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'statusToShow',
        header: this.statusTranslation(),
        sortable: true,
        filter: true,
      },
      { field: 'image', header: this.imageTranslation(), width: '240px' },
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
  private disableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.disable'),
    { initialValue: '' },
  );
  private enableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.enable'),
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
    title: this.transloco.translate('components.news.delete.title'),
    message: this.transloco.translate('components.news.delete.message'),
    confirm: this.transloco.translate('components.news.delete.confirm'),
    cancel: this.transloco.translate('components.news.delete.cancel'),
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

          const processedData = data.map((item: any) => ({
            ...item,
            statusToShow: item.status ? active : inactive,
          }));

          this.data.set(processedData);
          this.loading.set(false);
          this.loadMediaFiles(data);
        },
        error: () => {
          this.translateAndNotify('notifications.news.error.load', 'error');
          this.loading.set(false);
        },
      });
  }

  private loadMediaFiles(data: HomeData[]): void {
    data.forEach((item) => {
      if (item.photo) {
        const isVideo = item.photo.toLowerCase().endsWith('.mp4');

        this.srv
          .getImage(item.photo)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (fileBlob) => {
              const url = URL.createObjectURL(fileBlob);

              if (isVideo) {
                this.videoUrls.update((urls) => ({ ...urls, [item.id]: url }));
              } else {
                this.imageUrls.update((urls) => ({ ...urls, [item.id]: url }));
              }
            },
            error: () => {
              this.translateAndNotify(
                'notifications.news.error.loadImage',
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
    this.videoUrls.set({});
    this.loadData();
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.news.create.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditNewsComponent,
      showExpandButton: true,
      data: {
        initialData: {
          onSave: () => {
            this.onRefresh();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  edit(data: any): void {
    const translatedTitle = this.transloco.translate(
      'components.news.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditNewsComponent,
      showExpandButton: true,
      data: {
        initialData: {
          ...data,
          onSave: () => {
            this.onRefresh();
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
            this.onRefresh();
            this.translateAndNotify(
              'notifications.news.success.deleted',
              'success',
            );
          },
          error: (error) => {
            if (error?.error?.message && error.error?.statusCode === 400) {
              this.notificationSrv.addNotification(
                error.error.message,
                'error',
              );
            } else {
              this.translateAndNotify(
                'notifications.news.error.delete',
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
            this.translateAndNotify(
              'notifications.news.error.statusUpdate',
              'error',
            );
          }
        },
      });
  }

  moveNewsUp(data: any): void {
    const currentData = this.data();
    const currentIndex = currentData.findIndex((item) => item.id === data.id);

    if (currentIndex === 0) return; // Ya es la primera

    const currentItem = currentData[currentIndex];
    const previousItem = currentData[currentIndex - 1];

    const currentOrder = currentItem.order ?? currentIndex;
    const previousOrder = previousItem.order ?? currentIndex - 1;

    // Crear nuevo array con elementos intercambiados
    const newData = [...currentData];
    newData[currentIndex] = previousItem;
    newData[currentIndex - 1] = currentItem;
    this.data.set(newData);

    this.updateBothNewsOrder(
      currentItem.id,
      previousOrder,
      previousItem.id,
      currentOrder,
    );
  }

  moveNewsDown(data: any): void {
    const currentData = this.data();
    const currentIndex = currentData.findIndex((item) => item.id === data.id);

    if (currentIndex === currentData.length - 1) return; // Ya es la última

    const currentItem = currentData[currentIndex];
    const nextItem = currentData[currentIndex + 1];

    const currentOrder = currentItem.order ?? currentIndex;
    const nextOrder = nextItem.order ?? currentIndex + 1;

    // Crear nuevo array con elementos intercambiados
    const newData = [...currentData];
    newData[currentIndex] = nextItem;
    newData[currentIndex + 1] = currentItem;
    this.data.set(newData);

    this.updateBothNewsOrder(
      currentItem.id,
      nextOrder,
      nextItem.id,
      currentOrder,
    );
  }

  private updateBothNewsOrder(
    id1: number,
    order1: number,
    id2: number,
    order2: number,
  ): void {
    const update1$ = this.srv.updateOrder(id1, order1);
    const update2$ = this.srv.updateOrder(id2, order2);

    combineLatest([update1$, update2$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.onRefresh();
          this.translateAndNotify(
            'notifications.news.success.orderUpdated',
            'success',
          );
        },
        error: (error) => {
          this.onRefresh();
          if (error?.error?.message && error.error?.statusCode === 400) {
            this.notificationSrv.addNotification(error.error.message, 'error');
          } else {
            this.translateAndNotify(
              'notifications.news.error.orderUpdate',
              'error',
            );
          }
        },
      });
  }

  getImageUrl(rowData: HomeData): string {
    return this.imageUrls()[rowData.id] || '';
  }

  getVideoUrl(rowData: HomeData): string {
    return this.videoUrls()[rowData.id] || '';
  }

  isFirstItem(rowData: HomeData): boolean {
    const currentData = this.data();
    return currentData.findIndex((item) => item.id === rowData.id) === 0;
  }

  isLastItem(rowData: HomeData): boolean {
    const currentData = this.data();
    return (
      currentData.findIndex((item) => item.id === rowData.id) ===
      currentData.length - 1
    );
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  private translateAndNotify(
    key: string,
    severity: 'success' | 'error' | 'warning' | 'info',
    params?: object,
  ): void {
    const message = this.transloco.translate(key, params);
    this.notificationSrv.addNotification(message, severity);
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
