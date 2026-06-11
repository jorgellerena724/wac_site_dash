import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  untracked,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
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
  selector: 'app-create-edit-user',
  templateUrl: './create-edit-user.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditUserComponent implements DynamicComponent {
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
  id = signal<number>(0);
  uploading = signal<boolean>(false);

  // Formulario
  form: FormGroup;

  // Computed para detectar modo
  isEdit = computed(() => !!this.initialData()?.id);

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  constructor() {
    this.form = this.fb.group({
      id: [''],
      full_name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
        ],
      ],
      client: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
    });

    // Effect para inicializar datos y configurar validadores
    effect(() => {
      const data = this.initialData();
      untracked(() => {
        this.initializeForm(data);
      });
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  t(key: string): string {
    const prefix = this.isEdit()
      ? 'components.users.edit'
      : 'components.users.create';
    return this.transloco.translate(`${prefix}.${key}`);
  }

  private initializeForm(data: any): void {
    const passwordControl = this.form.get('password');

    if (this.isEdit()) {
      this.id.set(data.id || 0);
      this.form.patchValue(data);
      passwordControl?.clearValidators();
    } else {
      this.form.reset();
      passwordControl?.setValidators([
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(50),
        passwordValidator(),
      ]);
    }
    passwordControl?.updateValueAndValidity();

    if (data) {
      this.form.patchValue(data);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.users.error.formInvalid'),
        'warning',
      );
      this.markAllFieldsAsTouched();
      this.submitError.emit();
      return;
    }

    this.uploading.set(true);
    const formData = { ...this.form.value };

    const subscription$ = this.isEdit()
      ? this.srv.patch(formData)
      : this.srv.post(formData);

    subscription$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.uploading.set(false);
        const messageKey = this.isEdit()
          ? 'notifications.users.success.updated'
          : 'notifications.users.success.created';
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
        this.handleError(error);
        this.submitError.emit();
      },
    });
  }

  private handleError(error: any): void {
    let messageKey = this.isEdit()
      ? 'notifications.users.error.update'
      : 'notifications.users.error.create';

    if (error.error?.message?.includes('correo electrónico')) {
      messageKey = 'notifications.users.error.emailExists';
    }

    this.notificationSrv.addNotification(
      this.transloco.translate(messageKey),
      'error',
    );
  }

  markAllFieldsAsTouched(): void {
    Object.values(this.form.controls).forEach((control) => {
      control.markAsTouched();
      control.updateValueAndValidity({ onlySelf: true });
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
