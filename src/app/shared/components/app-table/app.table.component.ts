import {
  Component,
  input,
  output,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ChangeDetectionStrategy,
  untracked,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { ThemeService } from '../../../core/services/theme.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { debounceTime, Subject } from 'rxjs';
import { LucideDynamicIcon } from '@lucide/angular';
import { getLucideIcon } from '../../../core/constants/icons.constant';

export interface Column {
  field: string;
  header: string;
  sortable?: boolean;
  filter?: boolean;
  filterPlaceholder?: string;
  width?: string;
  defaultSort?: true;
  filterType?: 'text' | 'exact' | 'select';
  filterOptions?: { label: string; value: any }[];
}

export interface TableAction {
  label: string;
  icon: string;
  onClick: () => void;
  class?: string;
  isVisible?: () => boolean;
  isDisabled?: () => boolean;
}

export interface RowAction {
  label: string | ((data: any) => string);
  icon: string | ((data: any) => string);
  onClick: (rowData: any) => void;
  class?: string | ((data: any) => string);
  isVisible?: (rowData: any) => boolean;
  isDisabled?: (rowData: any) => boolean;
}

export interface PageChangeEvent {
  first: number;
  rows: number;
  page: number;
  pageCount: number;
}

export interface FilterChangeEvent {
  filters: { [key: string]: any };
}

@Component({
  selector: 'app-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ReactiveFormsModule,
    MenuModule,
    TooltipModule,
    PaginatorModule,
    SelectModule,
    TranslocoModule,
    LucideDynamicIcon,
  ],
  templateUrl: './app-table.component.html',
})
export class TableComponent {
  private fb = inject(FormBuilder);
  private themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);
  private transloco = inject(TranslocoService);

  readonly getIcon = getLucideIcon;

  isDark = toSignal(this.themeService.darkMode$, { initialValue: false });
  private actionsHeaderLabel = toSignal(
    this.transloco.selectTranslate('table.actions'),
    { initialValue: 'Acciones' },
  );

  // Inputs
  data = input<any[]>([]);
  columns = input<Column[]>([]);
  rowsPerPage = input<number>(10);
  loading = input<boolean>(false);
  showActionRow = input<boolean>(true);
  customTemplates = input<{ [key: string]: any }>({});
  headerActions = input<TableAction[]>([]);
  rowActions = input<RowAction[]>([]);
  hasShadow = input<boolean>(true);
  defaultSortField = input<string>('');
  defaultSortOrder = input<number>(1);

  serverSide = input<boolean>(false);
  totalRecords = input<number>(0);

  // Outputs
  refresh = output<void>();
  pageChange = output<PageChangeEvent>();
  filterChange = output<FilterChangeEvent>();

  dt = viewChild<Table>('dt');

  // State signals
  private originalData = signal<any[]>([]);
  filteredData = signal<any[]>([]);
  displayedData = signal<any[]>([]);
  localTotalRecords = signal<number>(0);
  first = signal<number>(0);
  showFilterInput = signal<{ [key: string]: boolean }>({});

  columnFiltersForm!: FormGroup;

  private filterSubject = new Subject<void>();

  // Computed signals
  columnsWithActions = computed<Column[]>(() => {
    const columnsArray = this.columns();
    const showAction = this.showActionRow();
    const rowActionsArray = this.rowActions();
    const translatedHeader = this.actionsHeaderLabel();

    if (showAction && rowActionsArray.length > 0) {
      return [
        {
          field: 'actions',
          header: translatedHeader || 'Acciones',
          width: '150px',
          defaultSort: true,
        },
        ...columnsArray,
      ];
    }
    return [...columnsArray];
  });

  effectiveTotalRecords = computed(() => {
    return this.serverSide() ? this.totalRecords() : this.localTotalRecords();
  });

  effectiveDisplayedData = computed(() => {
    return this.serverSide() ? this.data() : this.displayedData();
  });

  activeFilters = computed(() => {
    const form = this.columnFiltersForm;
    if (!form) return {};

    const active: { [key: string]: any } = {};
    Object.keys(form.controls).forEach((field) => {
      const value = form.get(field)?.value;
      if (value !== null && value !== undefined && value !== '') {
        active[field] = value;
      }
    });
    return active;
  });

  constructor() {
    this.columnFiltersForm = this.fb.group({});

    this.filterSubject.pipe(debounceTime(300)).subscribe(() => {
      if (this.serverSide()) {
        this.emitFilterChange();
      }
    });

    effect(() => {
      const newData = this.data();
      untracked(() => {
        this.originalData.set([...newData]);

        if (!this.serverSide()) {
          this.applyFilters();
        }
      });
    });

    effect(() => {
      const cols = this.columns();
      this.setupColumnFilters(cols);
    });

    effect(() => {
      const sortField = this.defaultSortField();
      const sortOrder = this.defaultSortOrder();
      const tableRef = this.dt();

      if (sortField && tableRef) {
        setTimeout(() => {
          tableRef.sortField = sortField;
          tableRef.sortOrder = sortOrder;
          tableRef.sortSingle();
        });
      }
    });

    effect(() => {
      const activeFilters = this.activeFilters();

      if (!this.serverSide()) {
        this.applyFilters();
      }
    });
  }

  private setupColumnFilters(cols: Column[]) {
    const filterControls: any = {};
    const filterVisibility: { [key: string]: boolean } = {};

    cols.forEach((col) => {
      if (col.filter) {
        filterControls[col.field] = [col.filterType === 'select' ? null : ''];
        filterVisibility[col.field] = false;
      }
    });

    this.columnFiltersForm = this.fb.group(filterControls);
    this.showFilterInput.set(filterVisibility);

    Object.keys(this.columnFiltersForm.controls).forEach((field) => {
      this.columnFiltersForm.get(field)?.valueChanges.subscribe(() => {
        this.first.set(0);

        if (this.serverSide()) {
          this.filterSubject.next();
        } else {
          this.applyFilters();
        }

        this.cdr.markForCheck();
      });
    });
  }

  private emitFilterChange() {
    const filters: { [key: string]: any } = {};

    Object.keys(this.columnFiltersForm.controls).forEach((field) => {
      const value = this.columnFiltersForm.get(field)?.value;
      if (value !== null && value !== undefined && value !== '') {
        filters[field] = value;
      }
    });

    this.filterChange.emit({ filters });
  }

  private applyFilters() {
    const original = this.originalData();
    let filtered = [...original];

    this.columns().forEach((col) => {
      if (col.filter && this.columnFiltersForm.get(col.field)?.value) {
        const filterValue = this.columnFiltersForm.get(col.field)?.value;

        if (col.filterType === 'select') {
          filtered = filtered.filter((item) => item[col.field] === filterValue);
        } else if (col.filterType === 'exact') {
          const searchTerm = String(filterValue).toLowerCase();
          filtered = filtered.filter(
            (item) => String(item[col.field]).toLowerCase() === searchTerm,
          );
        } else {
          const searchTerm = String(filterValue).toLowerCase();
          filtered = filtered.filter((item) =>
            String(item[col.field]).toLowerCase().includes(searchTerm),
          );
        }
      }
    });

    this.filteredData.set(filtered);
    this.localTotalRecords.set(filtered.length);
    this.updateDisplayedData();
  }

  private updateDisplayedData() {
    const filtered = this.filteredData();
    const firstIndex = this.first();
    const rows = this.rowsPerPage();
    const displayed = filtered.slice(firstIndex, firstIndex + rows);
    this.displayedData.set(displayed);
  }

  clearFilter(field: string) {
    const column = this.columns().find((col) => col.field === field);
    const value = column?.filterType === 'select' ? null : '';
    this.columnFiltersForm.get(field)?.setValue(value);

    const visibility = this.showFilterInput();
    this.showFilterInput.set({ ...visibility, [field]: false });
    this.cdr.markForCheck();
  }

  toggleFilter(field: string) {
    const visibility = this.showFilterInput();
    this.showFilterInput.set({ ...visibility, [field]: !visibility[field] });
    this.cdr.markForCheck();
  }

  onPageChange(event: any) {
    this.first.set(event.first);

    if (this.serverSide()) {
      this.pageChange.emit({
        first: event.first,
        rows: event.rows,
        page: event.page,
        pageCount: Math.ceil(this.totalRecords() / event.rows),
      });
    } else {
      const filtered = this.filteredData();
      const displayed = filtered.slice(event.first, event.first + event.rows);
      this.displayedData.set(displayed);
    }

    this.cdr.markForCheck();
  }

  refreshData() {
    this.refresh.emit();
  }

  isFirstPage(): boolean {
    return this.first() === 0;
  }

  isLastPage(): boolean {
    const total = this.effectiveTotalRecords();
    return this.first() + this.rowsPerPage() >= total;
  }

  next() {
    const total = this.serverSide() ? this.totalRecords() : this.filteredData().length;
    let first = this.first() + this.rowsPerPage();

    if (first >= total) {
      first = total - this.rowsPerPage();
    }

    this.first.set(first);

    if (this.serverSide()) {
      const page = Math.floor(first / this.rowsPerPage());
      this.pageChange.emit({
        first: first,
        rows: this.rowsPerPage(),
        page: page,
        pageCount: Math.ceil(total / this.rowsPerPage()),
      });
    } else {
      this.updateDisplayedData();
    }
  }

  prev() {
    let first = this.first() - this.rowsPerPage();

    if (first < 0) {
      first = 0;
    }

    this.first.set(first);

    if (this.serverSide()) {
      const page = Math.floor(first / this.rowsPerPage());
      this.pageChange.emit({
        first: first,
        rows: this.rowsPerPage(),
        page: page,
        pageCount: Math.ceil(this.totalRecords() / this.rowsPerPage()),
      });
    } else {
      this.updateDisplayedData();
    }
  }

  reset() {
    this.first.set(0);

    if (this.serverSide()) {
      this.pageChange.emit({
        first: 0,
        rows: this.rowsPerPage(),
        page: 0,
        pageCount: Math.ceil(this.totalRecords() / this.rowsPerPage()),
      });
    } else {
      this.updateDisplayedData();
    }
  }

  getRowActionLabel(action: RowAction, rowData: any): string {
    return typeof action.label === 'function' ? action.label(rowData) : action.label;
  }

  getRowActionIcon(action: RowAction, rowData: any): string {
    const iconName = typeof action.icon === 'function' ? action.icon(rowData) : action.icon;
    if (this.isLucideIcon(iconName)) {
      return '';
    }
    return iconName;
  }

  getHeaderActionIcon(action: TableAction): string {
    if (this.isLucideIcon(action.icon)) {
      return '';
    }
    return action.icon;
  }

  isLucideIcon(iconName: string): boolean {
    return !!iconName;
  }

  getRowActionIconName(action: RowAction, rowData: any): string {
    return typeof action.icon === 'function' ? action.icon(rowData) : action.icon;
  }

  getRowActionClass(action: RowAction, rowData: any): string {
    if (!action.class) return '';
    return typeof action.class === 'function' ? action.class(rowData) : action.class;
  }

  isHeaderActionDisabled(action: TableAction): boolean {
    return action.isDisabled ? action.isDisabled() : false;
  }

  isHeaderActionVisible(action: TableAction): boolean {
    return action.isVisible ? action.isVisible() : true;
  }

  isRowActionDisabled(action: RowAction, rowData: any): boolean {
    return action.isDisabled ? action.isDisabled(rowData) : false;
  }

  isRowActionVisible(action: RowAction, rowData: any): boolean {
    return action.isVisible ? action.isVisible(rowData) : true;
  }

  truncate(value: any, limit: number = 30): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str.length > limit ? str.slice(0, limit) + '…' : str;
  }
}
