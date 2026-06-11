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
import { passwordValidator } from '../../../core/validators/password.validator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateUserComponent implements DynamicComponent {
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

  createdMessage = computed(() =>
    this.transloco.translate('notifications.users.success.created'),
  );

  createErrorMessage = computed(() =>
    this.transloco.translate('notifications.users.error.create'),
  );

  emailExistsMessage = computed(() =>
    this.transloco.translate('notifications.users.error.emailExists'),
  );

  constructor() {
    this.form = this.fb.group({
      full_name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
        ],
      ],
      client: ['', Validators.required],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(50),
          passwordValidator(),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
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
    this.uploading.set(true);

    this.srv
      .post(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.createdMessage(),
            'success',
          );
          this.submitSuccess.emit();

          const data = this.initialData();
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
              this.createErrorMessage(),
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
