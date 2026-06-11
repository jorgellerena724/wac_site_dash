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
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { ReviewService } from '../../../../shared/services/features/review.service';
import { CreateEditReviewComponent } from '../create-edit-review/create-edit-review.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-review',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-review.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListReviewComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(ReviewService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // ViewChild signals
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');
  ratingTemplate = viewChild<TemplateRef<any>>('ratingTemplate');

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: any }>(() => {
    const imgTemplate = this.imageTemplate();
    const ratingTpl = this.ratingTemplate();
    const templates: { [key: string]: any } = {};

    if (imgTemplate) templates['image'] = imgTemplate;
    if (ratingTpl) templates['star_rating'] = ratingTpl;

    return templates;
  });

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.reviews.list.table.name'),
    { initialValue: '' },
  );
  private descriptionTranslation = toSignal(
    this.transloco.selectTranslate('components.reviews.list.table.description'),
    { initialValue: '' },
  );
  private imageTranslation = toSignal(
    this.transloco.selectTranslate('components.reviews.list.table.image'),
    { initialValue: '' },
  );
  private ratingTranslation = toSignal(
    this.transloco.selectTranslate('components.reviews.list.table.rating'),
    { initialValue: 'Calificación' },
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
        field: 'star_rating',
        header: this.ratingTranslation(),
        sortable: true,
        width: '160px',
      },
      {
        field: 'image',
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
  private importTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.import'),
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
      {
        label: this.importTranslation(),
        icon: icons['importFile'],
        onClick: () => this.import(),
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

          // Cargar las imágenes
          this.loadReviewImages(data);
        },
        error: (error) => {
          const message = this.transloco.translate(
            'notifications.reviews.error.load',
          );
          this.notificationSrv.addNotification(message, 'error');
          this.loading.set(false);
        },
      });
  }

  private loadReviewImages(reviews: HomeData[]): void {
    reviews.forEach((item) => {
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
              const message = this.transloco.translate(
                'notifications.reviews.error.loadImage',
              );
              this.notificationSrv.addNotification(message, 'error');
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

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.reviews.create.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditReviewComponent,
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
      'components.reviews.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditReviewComponent,
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
    const titleTranslation = this.transloco.translate(
      'components.reviews.delete.title',
    );
    const messageTranslation = this.transloco.translate(
      'components.reviews.delete.message',
    );
    const confirmTranslation = this.transloco.translate(
      'components.reviews.delete.confirm',
    );
    const cancelTranslation = this.transloco.translate(
      'components.reviews.delete.cancel',
    );

    const confirmed = await this.confirmDialogService.confirm({
      title: titleTranslation,
      message: messageTranslation,
      confirmLabel: confirmTranslation,
      cancelLabel: cancelTranslation,
    });

    if (confirmed) {
      this.loading.set(true);

      this.srv
        .delete(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.onRefresh();
            const message = this.transloco.translate(
              'notifications.reviews.success.deleted',
            );
            this.notificationSrv.addNotification(message, 'success');
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes('No se puede eliminar la reseña')
            ) {
              this.notificationSrv.addNotification(
                error.error.message,
                'error',
              );
            } else {
              const message = this.transloco.translate(
                'notifications.reviews.error.delete',
              );
              this.notificationSrv.addNotification(message, 'error');
            }
            this.loading.set(false);
          },
        });
    }
  }

  getImageUrl(rowData: HomeData): string {
    return this.imageUrls()[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  getStarsArray(rating: number | null | undefined): number[] {
    const val = rating ?? 0;
    const full = Math.floor(val);
    const hasHalf = val - full >= 0.25 && val - full < 0.75;
    const empty = 5 - full - (hasHalf ? 1 : 0);
    return [
      ...Array(full).fill(1),
      ...(hasHalf ? [0.5] : []),
      ...Array(empty).fill(0),
    ];
  }

  private cleanupBlobUrls(): void {
    const images = this.imageUrls();

    Object.values(images).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }

  import(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      this.loading.set(true);
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('source', 'google');

      this.srv
        .import(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.notificationSrv.addNotification(
              this.transloco.translate(
                'notifications.reviews.success.imported',
                {
                  created: res.created,
                  skipped: res.skipped,
                },
              ),
              'success',
            );
            this.loading.set(false);
            this.onRefresh();
          },
          error: (err) => {
            this.notificationSrv.addNotification(
              err?.error?.detail ??
                this.transloco.translate('notifications.reviews.error.import'),
              'error',
            );
            this.loading.set(false);
          },
        });
    };

    input.click();
  }
}
