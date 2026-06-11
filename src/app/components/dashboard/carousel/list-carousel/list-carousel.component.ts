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
import { CarouselService } from '../../../../shared/services/features/carousel.service';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { UpdateCarouselComponent } from '../update-carousel/update-carousel.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-carousel',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-carousel.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListCarouselComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(CarouselService);
  private destroyRef = inject(DestroyRef);

  // ViewChild usando signal
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: any }>(() => {
    const template = this.imageTemplate();
    return template ? { image: template } : {};
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
    this.transloco.selectTranslate('components.carousel.list.table.name'),
    { initialValue: '' },
  );
  private descriptionTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.carousel.list.table.description',
    ),
    { initialValue: '' },
  );
  private statusTranslation = toSignal(
    this.transloco.selectTranslate('components.news.list.table.status'),
    { initialValue: '' },
  );
  private imageTranslation = toSignal(
    this.transloco.selectTranslate('components.carousel.list.table.image'),
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
        field: 'description',
        header: this.descriptionTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'statusToShow',
        header: this.statusTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'image',
        header: this.imageTranslation(),
        width: '240px',
      },
    ];
  });

  headerActions = computed<TableAction[]>(() => {
    return [];
  });

  // Signals reactivos para traducciones de acciones
  private editTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.edit'),
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

  rowActions = computed<RowAction[]>(() => {
    return [
      {
        label: this.editTranslation(),
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
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

          // Cargar imágenes
          data.forEach((item) => {
            if (item.photo) {
              this.srv
                .getImage(item.photo)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: (imageBlob) => {
                    const currentUrls = this.imageUrls();
                    this.imageUrls.set({
                      ...currentUrls,
                      [item.id]: URL.createObjectURL(imageBlob),
                    });
                  },
                  error: (error) => {
                    const message = this.transloco.translate(
                      'notifications.carousel.error.loadImage',
                    );
                    this.notificationSrv.addNotification(message, 'error');
                  },
                });
            }
          });
        },
        error: (error) => {
          const message = this.transloco.translate(
            'notifications.carousel.error.load',
          );
          this.notificationSrv.addNotification(message, 'error');
          this.loading.set(false);
        },
      });
  }

  onRefresh(): void {
    // Limpiar URLs de imágenes anteriores
    const urls = this.imageUrls();
    Object.values(urls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.imageUrls.set({});
    this.loadData();
  }

  edit(data: any): void {
    const translatedTitle = this.transloco.translate(
      'components.carousel.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: UpdateCarouselComponent,
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

  getImageUrl(rowData: HomeData): string {
    const urls = this.imageUrls();
    return urls[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  toggleStatus(data: any): void {
    const currentData = this.data();
    const activeItems = currentData.filter(
      (item) => item.status && item.id !== data.id,
    ).length;

    if (data.status && activeItems < 2) {
      const translatedError = this.transloco.translate(
        'components.carousel.list.errors.min_active',
      );
      this.notificationSrv.addNotification(translatedError, 'error');
      return;
    }

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

          // Actualizar el estado local
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
            'notifications.carousel.success.statusUpdated',
            { status: statusText },
          );
          this.notificationSrv.addNotification(message, 'success');
        },
        error: (error) => {
          if (error?.error?.message && error.error?.statusCode === 400) {
            this.notificationSrv.addNotification(
              error.error.message + '.',
              'error',
            );
          } else {
            const message = this.transloco.translate(
              'notifications.carousel.error.statusUpdate',
            );
            this.notificationSrv.addNotification(message, 'error');
          }
        },
      });
  }
}
