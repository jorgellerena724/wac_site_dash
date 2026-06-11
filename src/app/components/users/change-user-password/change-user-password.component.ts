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
import { UserService } from '../../../shared/services/users/user.service';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { passwordValidator } from '../../../core/validators/password.validator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-change-user-password',
  templateUrl: './change-user-password.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeUserPasswordComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private userSrv = inject(UserService);
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
    this.transloco.translate('notifications.users.error.formInvalid')
  );

  passwordChangedMessage = computed(() =>
    this.transloco.translate('notifications.users.success.passwordChanged')
  );

  changePasswordErrorMessage = computed(() =>
    this.transloco.translate('notifications.users.error.changePassword')
  );

  emailText = computed(() =>
    this.transloco.translate('components.users.password.email')
  );

  constructor() {
    this.form = this.fb.group(
      {
        id: [''],
        email: [''],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(96),
            passwordValidator(),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data?.email) {
        untracked(() => {
          this.form.patchValue({
            id: data.id,
            email: data.email,
          });
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

  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password === confirmPassword) {
      form.get('confirmPassword')?.setErrors(null);
      return null;
    }

    form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.formInvalidMessage(),
        'warning'
      );
      this.form.markAllAsTouched();
      this.submitError.emit();
      return;
    }

    const formData = {
      id: this.form.get('id')?.value,
      newPassword: this.form.get('newPassword')?.value,
    };

    this.uploading.set(true);

    this.userSrv
      .changePassword(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.passwordChangedMessage(),
            'success'
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
          this.notificationSrv.addNotification(
            this.changePasswordErrorMessage(),
            'error'
          );
          this.submitError.emit();
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
