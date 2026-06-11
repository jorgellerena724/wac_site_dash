import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
  viewChild,
  untracked,
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
import { HeaderService } from '../../../../shared/services/features/header.service';
import { icons } from '../../../../core/constants/icons.constant';
import { UpdateHeaderComponent } from '../update-header/update-header.component';
import { HeaderData } from '../../../../shared/interfaces/headerData.interface';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-header',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-header.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListHeaderComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(HeaderService);
  private destroyRef = inject(DestroyRef);

  imageTemplate = viewChild('imageTemplate');

  // Signals para el estado
  data = signal<HeaderData[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});

  // Computed signals para templates
  customTemplates = computed<{ [key: string]: any }>(() => {
    const template = this.imageTemplate();
    return template ? { image: template } : {};
  });

  // Signals reactivos para traducciones de columnas
  private nameTranslation = toSignal(
    this.transloco.selectTranslate('components.header.list.table.name'),
    { initialValue: '' }
  );
  private imageTranslation = toSignal(
    this.transloco.selectTranslate('components.header.list.table.image'),
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
        field: 'image',
        header: this.imageTranslation(),
        width: '240px',
      },
    ];
  });

  headerActions = computed<TableAction[]>(() => {
    return []; // Este componente no tiene acciones de header
  });

  // Signal reactivo para traducción de acción
  private editTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.edit'),
    { initialValue: '' }
  );

  rowActions = computed<RowAction[]>(() => {
    return [
      {
        label: this.editTranslation(),
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
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
        next: (data: HeaderData[]) => {
          this.data.set(data);
          this.loading.set(false);
          this.loadImages(data);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.header.error.load'),
            'error'
          );
          this.loading.set(false);
        },
      });
  }

  private loadImages(data: HeaderData[]): void {
    data.forEach((item) => {
      if (item.logo) {
        this.srv
          .getImage(item.logo)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (imageBlob) => {
              const url = URL.createObjectURL(imageBlob);
              untracked(() => {
                this.imageUrls.update((urls) => ({
                  ...urls,
                  [item.id]: url,
                }));
              });
            },
            error: (error) => {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.header.error.loadImage'
                ),
                'error'
              );
            },
          });
      }
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
      'components.header.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: UpdateHeaderComponent,
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

  getImageUrl(rowData: HeaderData): string {
    return this.imageUrls()[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }
}
