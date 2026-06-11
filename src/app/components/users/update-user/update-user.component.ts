import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  untracked,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { UserService } from '../../../shared/services/users/user.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-update-user',
  templateUrl: './update-user.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateUserComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(UserService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  uploading = signal<boolean>(false);

  // Formulario
  form: FormGroup;

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  // Computed para traducciones de error
  formInvalidMessage = computed(() =>
    this.transloco.translate('notifications.users.error.formInvalid'),
  );

  updatedMessage = computed(() =>
    this.transloco.translate('notifications.users.success.updated'),
  );

  updateErrorMessage = computed(() =>
    this.transloco.translate('notifications.users.error.update'),
  );

  emailExistsMessage = computed(() =>
    this.transloco.translate('notifications.users.error.emailExists'),
  );

  constructor() {
    this.form = this.fb.group({
      id: [''],
      client: ['', Validators.required],
      full_name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          // Primero hacemos una copia del initialData para no modificar el original
          const formData = { ...data };
          this.form.patchValue(formData);
        });
      }
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid);
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  onSubmit(): void {
    // Validar el formulario
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.formInvalidMessage(),
        'warning',
      );
      this.submitError.emit();
      return;
    }

    // Procesar el formulario
    const formData = { ...this.form.value };
    const data = this.initialData();
    formData.id = data?.id;

    this.uploading.set(true);

    this.srv
      .patch(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.updatedMessage(),
            'success',
          );
          this.submitSuccess.emit();

          if (data?.onSave && typeof data.onSave === 'function') {
            data.onSave();
          }

          if (!data?.closeOnSubmit) {
            this.form.reset();
          }
        },
        error: (error) => {
          this.uploading.set(false);
          if (error.error.message.includes('correo electrónico')) {
            this.notificationSrv.addNotification(
              this.emailExistsMessage(),
              'error',
            );
          } else {
            this.notificationSrv.addNotification(
              this.updateErrorMessage(),
              'error',
            );
          }
          this.submitError.emit();
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
