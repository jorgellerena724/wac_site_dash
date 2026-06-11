import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  input,
  output,
  DestroyRef,
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
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-create-edit-publication-category',
  templateUrl: './create-edit-publication-category.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditPublicationCategoryComponent implements DynamicComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private srv = inject(PublicationCategoryService);
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  uploading = signal<boolean>(false);

  // Computed para detectar modo
  isEdit = computed(() => !!this.initialData()?.id);

  // Computed signals
  isFormInvalid = computed(() => {
    return this.form.invalid || this.uploading();
  });

  // Formulario
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
    });

    // Effects
    effect(() => {
      const data = this.initialData();
      if (data) {
        this.form.patchValue(data);
        this.id.set(data.id || 0);
      }
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.publication-category.edit'
      : 'components.publication-category.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate(
          'notifications.publication-category.error.formInvalid',
        ),
        'warning',
      );

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    this.uploading.set(true);

    const subscription$ = this.isEdit()
      ? this.srv.patch(formData, this.id())
      : this.srv.post(formData);

    subscription$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.uploading.set(false);
        const messageKey = this.isEdit()
          ? 'notifications.publication-category.success.updated'
          : 'notifications.publication-category.success.created';

        this.notificationSrv.addNotification(
          this.transloco.translate(messageKey),
          'success',
        );
        this.submitSuccess.emit();

        const data = this.initialData();
        if (data?.onSave) {
          data.onSave();
        }

        if (!data?.closeOnSubmit) {
          this.form.reset();
        }
      },
      error: (error) => {
        this.uploading.set(false);
        const messageKey = this.isEdit()
          ? 'notifications.publication-category.error.update'
          : 'notifications.publication-category.error.create';

        this.notificationSrv.addNotification(
          this.transloco.translate(messageKey),
          'error',
        );
        this.submitError.emit();
        console.error('Error:', error);
      },
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
