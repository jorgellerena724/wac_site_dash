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
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { NewsService } from '../../../../shared/services/features/news.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-create-edit-news',
  templateUrl: './create-edit-news.component.html',
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
export class CreateEditNewsComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(NewsService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private sanitizer = inject(DomSanitizer);
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
  isVideo = signal<boolean>(false);
  videoUrl = signal<SafeResourceUrl | null>(null);

  // Formulario
  form: FormGroup;

  // Computed para modo (create vs edit)
  isEdit = computed(() => !!this.initialData()?.id);

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      fecha: [''],
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
            this.loadCurrentMedia();
          }
        });
      }
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  private loadCurrentMedia(): void {
    const data = this.initialData();
    if (!data?.photo) return;

    this.loadingImage.set(true);

    // Determinar si es video por la extensión
    const extension = data.photo.split('.').pop()?.toLowerCase();
    const isVideoFile = ['mp4', 'webm', 'mov'].includes(extension || '');
    this.isVideo.set(isVideoFile);

    this.srv
      .getImage(data.photo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          if (isVideoFile) {
            this.createVideoPreview(blob, extension);
          } else {
            this.createImagePreview(blob);
          }
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
        error: () => {
          if (isVideoFile) {
            this.setFallbackVideo();
          } else {
            this.setFallbackImage();
          }
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
      });
  }

  private createVideoPreview(blob: Blob, extension: string | undefined): void {
    // Determinar el tipo MIME basado en la extensión
    let mimeType = 'video/mp4';
    if (extension === 'mov') mimeType = 'video/quicktime';
    if (extension === 'webm') mimeType = 'video/webm';
    if (extension === 'ogg') mimeType = 'video/ogg';

    const videoBlob = new Blob([blob], { type: mimeType });
    this.videoUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(
        URL.createObjectURL(videoBlob),
      ),
    );
  }

  private setFallbackVideo(): void {
    const data = this.initialData();
    this.videoUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(data?.photo || ''),
    );
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
    this.imageUrl.set(data?.photo || null);
  }

  onFileUploaded(files: File[]): void {
    const file = files[0];
    this.selectedFile.set(file);
    this.form.get('image')?.setValue(file);

    // Determinar si es video
    const supportedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
    ];

    const isVideoFile = supportedVideoTypes.includes(file.type);
    this.isVideo.set(isVideoFile);

    if (isVideoFile) {
      const videoUrl = URL.createObjectURL(file);
      this.videoUrl.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl),
      );
      this.imageUrl.set(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrl.set(reader.result as string);
        this.videoUrl.set(null);
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile(): void {
    // Revocar URLs de objetos
    const imgUrl = this.imageUrl();
    const vidUrl = this.videoUrl();

    if (imgUrl && imgUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imgUrl);
    }

    if (vidUrl) {
      const unsafeUrl = vidUrl as any;
      if (unsafeUrl.changingThisBreaksApplicationSecurity) {
        URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
      }
    }

    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.videoUrl.set(null);
    this.isVideo.set(false);
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ image: null });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.news.error.formInvalid'),
        'warning',
      );

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    // Preservar saltos de línea en la descripción
    const description = this.form.get('description')?.value;
    const processedDescription = description
      .split('\n')
      .map((line: string) => line.trimEnd())
      .join('\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
    formData.append('description', processedDescription);

    // Manejar fecha
    const rawFecha = this.form.get('fecha')?.value;
    const fechaValue = rawFecha ? rawFecha.toString().trim() : '';
    formData.append('fecha', fechaValue);

    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file, file.name);
    }

    this.uploading.set(true);

    if (!this.isEdit()) {
      // Create
      this.srv
        .post(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.uploading.set(false);

            const message = this.transloco.translate(
              'notifications.news.success.created',
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
            this.handleError(error, false);
            this.submitError.emit();
          },
        });
    } else {
      // Update
      this.srv
        .patch(formData, this.id())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.uploading.set(false);

            const message = this.transloco.translate(
              'notifications.news.success.updated',
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
            this.handleError(error, true);
            this.submitError.emit();
          },
        });
    }
  }

  private handleError(error: any, isUpdate: boolean): void {
    let messageKey = isUpdate
      ? 'notifications.news.error.update'
      : 'notifications.news.error.create';

    if (
      error.status === 400 &&
      error.error.message?.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor',
      )
    ) {
      messageKey = 'notifications.news.error.duplicateImage';
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
    this.videoUrl.set(null);
    this.isVideo.set(false);
  }

  get isFormInvalid(): boolean {
    return this.form.invalid || this.uploading();
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

  // Helper para traducciones dinámicas en template
  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.news.edit'
      : 'components.news.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}
