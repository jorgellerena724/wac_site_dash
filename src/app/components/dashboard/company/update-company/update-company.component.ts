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
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { CompanyService } from '../../../../shared/services/features/company.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-update-company',
  templateUrl: './update-company.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
    TooltipModule,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateCompanyComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(CompanyService);
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
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(3)]],
      image: ['', Validators.required],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
          this.id.set(data.id || 0);

          if (data.photo) {
            this.loadCurrentImage();
          }
        });
      }
    });

    // Effect para emitir validez del formulario
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
    if (!data?.photo) return;

    this.loadingImage.set(true);

    this.srv
      .getImage(data.photo)
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

  onFileSelected(file: File): void {
    this.selectedFile.set(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  onFileUploaded(files: File[]): void {
    const file = files[0]; // Only handle the first file since this component supports single file upload
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
    this.imageUrl.set(data?.route || null);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        'notifications.company.error.formInvalid',
        'warning',
      );

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.getRawValue());

    // Preservar saltos de línea en la descripción
    const description = this.form.get('description')?.value;
    const processedDescription = description
      .split('\n')
      .map((line: string) => line.trimEnd())
      .join('\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
    formData.append('description', processedDescription);

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

          const message = this.transloco.translate(
            'notifications.company.success.updated',
          );
          this.notificationSrv.addNotification(message, 'success');
          this.submitSuccess.emit();

          const data = this.initialData();
          if (data?.onSave) {
            data.onSave();
          }

          if (!data?.closeOnSubmit) {
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
    let messageKey = 'notifications.company.error.update';

    if (
      error.status === 400 &&
      error.error.message?.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor',
      )
    ) {
      messageKey = 'notifications.company.error.duplicateImage';
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
    this.form.patchValue({ image: null });
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');

    console.error('Error de validación de archivo:"File validation error:"', {
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
