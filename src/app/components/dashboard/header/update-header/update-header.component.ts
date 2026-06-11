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
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { HeaderService } from '../../../../shared/services/features/header.service';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-update-header',
  templateUrl: './update-header.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TooltipModule,
    TranslocoModule,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateHeaderComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(HeaderService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  onSave = input<(() => void) | undefined>(undefined);
  closeOnSubmit = input<boolean>(false);
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  selectedFile = signal<File | null>(null);
  uploading = signal<boolean>(false);
  loadingImage = signal<boolean>(false);
  imageUrl = signal<string | null>(null);

  // Formulario
  form: FormGroup;

  // Computed para validación
  isFormInvalid = signal(false);

  constructor() {
    this.form = this.fb.group({
      name: [''],
      image: ['', Validators.required],
    });

    // Efecto para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
          this.id.set(data.id || 0);

          if (data.logo) {
            this.loadCurrentImage();
          }
        });
      }
    });

    // Efecto para emitir validez del formulario
    effect(() => {
      const isValid = this.form.valid;
      this.formValid.emit(isValid);
      this.isFormInvalid.set(!isValid || this.uploading());
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  private loadCurrentImage(): void {
    const data = this.initialData();
    if (!data?.logo) return;

    this.loadingImage.set(true);

    this.srv
      .getImage(data.logo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          this.createImagePreview(blob);
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
        error: () => {
          this.setFallbackImage();
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
      });
  }

  onFileUploaded(files: File[]): void {
    const file = files[0];
    this.selectedFile.set(file);
    this.form.get('image')?.setValue(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.imageUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  private createImagePreview(blob: Blob): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.imageUrl.set(reader.result as string);
    };
    reader.readAsDataURL(new Blob([blob]));
  }

  private setFallbackImage(): void {
    const data = this.initialData();
    this.imageUrl.set(data?.logo || null);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.uploading()) {
      if (this.form.invalid) {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.header.error.formInvalid'),
          'warning',
        );
      }
      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('name', this.form.get('name')?.value);

    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file, file.name);
    }

    this.uploading.set(true);

    this.srv
      .patch(formData, this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);

          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.header.success.updated'),
            'success',
          );

          this.submitSuccess.emit();

          const onSaveCallback = this.onSave();
          if (onSaveCallback) {
            onSaveCallback();
          }

          if (!this.closeOnSubmit()) {
            this.resetForm();
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
    let messageKey = 'notifications.header.error.update';

    if (
      error.status === 400 &&
      error.error.message?.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor',
      )
    ) {
      messageKey = 'notifications.header.error.duplicateImage';
    }

    this.notificationSrv.addNotification(
      this.transloco.translate(messageKey),
      'error',
    );
  }

  private resetForm(): void {
    this.form.reset();
    this.selectedFile.set(null);
    this.imageUrl.set(null);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
    console.error('Error de validación de archivo', {
      type: error.type,
      message: error.message,
      fileName: error.file.name,
      fileSize: error.file.size,
      fileType: error.file.type,
    });
    this.selectedFile.set(null);
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}
