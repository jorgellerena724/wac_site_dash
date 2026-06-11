import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { ManagerCategoryService } from '../../../../shared/services/features/manager-category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-create-edit-manager-category',
  templateUrl: './create-edit-manager-category.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditManagerCategoryComponent implements DynamicComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private srv = inject(ManagerCategoryService);
  private notificationSrv = inject(NotificationService);

  // Signals
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Variables
  id = signal<number>(0);
  isSubmitting = signal<boolean>(false);
  form: FormGroup;

  // Computed para modo (create vs edit)
  isEdit = computed(() => !!this.initialData()?.id);

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
    });

    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
          this.id.set(data.id || 0);
        });
      }
    });

    this.form.statusChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.formValid.emit(status === 'VALID'));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.submitError.emit();
      return;
    }

    this.isSubmitting.set(true);
    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    const subscription$ = this.isEdit()
      ? this.srv.patch(formData, this.id())
      : this.srv.post(formData);

    subscription$.subscribe({
      next: () => {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.categories.success.created'),
          'success',
        );
        this.submitSuccess.emit();

        const data = this.initialData();
        if (data?.onSave) data.onSave();
        if (!data?.closeOnSubmit) this.form.reset();

        this.isSubmitting.set(false);
      },
      error: (error) => {
        const msgKey =
          error.status === 400 && error.error?.detail?.includes('Ya existe')
            ? 'notifications.categories.error.duplicateName'
            : 'notifications.categories.error.create';

        this.notificationSrv.addNotification(
          this.transloco.translate(msgKey),
          'error',
        );

        this.isSubmitting.set(false);
        this.submitError.emit();
      },
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  // Helper para traducciones dinámicas en template
  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.manager-category.edit'
      : 'components.manager-category.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }
}
