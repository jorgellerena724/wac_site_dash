import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  signal,
  ChangeDetectionStrategy,
  computed,
  viewChild,
  TemplateRef,
  DestroyRef,
  effect,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MetricsService,
  MetricEvent,
  MetricsConfig,
} from '../../../../shared/services/features/metrics.service';
import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../../../../shared/components/app-table/app.table.component';
import {
  ModalService,
  ModalConfig,
} from '../../../../shared/services/system/modal.service';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { CreateEditStatisticComponent } from '../create-edit-statistic/create-edit-statistic.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { icons } from '../../../../core/constants/icons.constant';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';

@Component({
  selector: 'app-list-metric-config',
  standalone: true,
  imports: [CommonModule, TranslocoModule, TableComponent, TooltipModule],
  templateUrl: './list-metric-config.component.html',
  styleUrls: ['./list-metric-config.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListMetricConfigComponent {
  private cd = inject(ChangeDetectorRef);
  private metricsSrv = inject(MetricsService);
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<MetricEvent[]>([]);
  loading = signal<boolean>(false);
  config = signal<MetricsConfig | null>(null);

  // Signals reactivos para traducciones de columnas
  private eventNameTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.statistics.config.table.event_name',
    ),
    { initialValue: '' },
  );
  private labelTranslation = toSignal(
    this.transloco.selectTranslate('components.statistics.config.table.label'),
    { initialValue: '' },
  );
  private clientTranslation = toSignal(
    this.transloco.selectTranslate('components.statistics.config.table.client'),
    { initialValue: '' },
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    return [
      {
        field: 'client',
        header: this.clientTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'event_name',
        header: this.eventNameTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'label',
        header: this.labelTranslation(),
        sortable: true,
        filter: true,
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
  private activateTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.enable'),
    { initialValue: '' },
  );
  private deactivateTranslation = toSignal(
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
    ];
  });

  constructor() {
    effect(() => this.loadData());
  }

  loadData(): void {
    this.loading.set(true);
    this.metricsSrv
      .getAllConfigs()
      .pipe(takeUntilDestroyed(this.destroyRef)) // ← ya no necesita destroy$
      .subscribe({
        next: (configs) => {
          this.data.set(
            configs.map((data: any) => ({
              ...data,
              client: data.user?.client ?? data.user_id,
              event_name:
                data.events?.map((e: any) => e.event_name).join(', ') ?? '',
              label: data.events?.map((e: any) => e.label).join(', ') ?? '',
            })),
          );
          this.loading.set(false);
          this.cd.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cd.markForCheck();
        },
      });
  }

  onRefresh(): void {
    this.loadData();
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.statistics.create.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditStatisticComponent,
      showExpandButton: false,
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

  edit(data: MetricEvent): void {
    const translatedTitle = this.transloco.translate(
      'components.statistics.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditStatisticComponent,
      showExpandButton: false,
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
    const confirmed = await this.confirmDialogService.confirm({
      title: this.transloco.translate('components.statistics.delete.title'),
      message: this.transloco.translate('components.statistics.delete.message'),
      confirmLabel: this.transloco.translate(
        'components.statistics.delete.confirm',
      ),
      cancelLabel: this.transloco.translate(
        'components.statistics.delete.cancel',
      ),
    });

    if (confirmed) {
      this.loading.set(true);
      this.metricsSrv
        .deleteConfig(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.onRefresh();
            this.notificationSrv.addNotification(
              this.transloco.translate(
                'notifications.statistics.success.deleted',
              ),
              'success',
            );
          },
          error: () => {
            this.notificationSrv.addNotification(
              this.transloco.translate('notifications.statistics.error.delete'),
              'error',
            );
            this.loading.set(false);
          },
        });
    }
  }
}
