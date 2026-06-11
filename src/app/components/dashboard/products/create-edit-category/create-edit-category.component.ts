import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  untracked,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { CategoryService } from '../../../../shared/services/features/category.service';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';

@Component({
  selector: 'app-create-edit-category',
  templateUrl: './create-edit-category.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditCategoryComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private srv = inject(CategoryService);
  private notificationSrv = inject(NotificationService);

  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  id = signal<number>(0);
  isSubmitting = signal<boolean>(false);
  form: FormGroup;

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

  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.category.edit'
      : 'components.category.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) {
      this.submitError.emit();
      return;
    }

    if (this.form.invalid) {
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
        const messageKey = this.isEdit()
          ? 'notifications.categories.success.updated'
          : 'notifications.categories.success.created';

        this.notificationSrv.addNotification(
          this.transloco.translate(messageKey),
          'success',
        );
        this.submitSuccess.emit();

        const data = this.initialData();
        if (data?.onSave) data.onSave();
        if (!data?.closeOnSubmit) this.form.reset();

        this.isSubmitting.set(false);
      },
      error: (error) => {
        this.handleError(error, this.isEdit());
        this.isSubmitting.set(false);
        this.submitError.emit();
      },
    });
  }

  private handleError(error: any, isUpdate: boolean): void {
    const msgKey =
      error.status === 400 && error.error?.detail?.includes('Ya existe')
        ? 'notifications.categories.error.duplicateName'
        : 'notifications.categories.error.create';

    this.notificationSrv.addNotification(
      this.transloco.translate(msgKey),
      'error',
    );
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  markAllFieldsAsTouched(): void {
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      if (control) {
        control.markAsTouched();
        control.updateValueAndValidity({ onlySelf: true, emitEvent: true });
      }
    });
  }
}
