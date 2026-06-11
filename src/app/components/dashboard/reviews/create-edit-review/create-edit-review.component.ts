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
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { ReviewService } from '../../../../shared/services/features/review.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LucideDynamicIcon } from '@lucide/angular';
import { getLucideIcon } from '../../../../core/constants/icons.constant';

@Component({
  selector: 'app-create-edit-review',
  templateUrl: './create-edit-review.component.html',
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
export class CreateEditReviewComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ReviewService);
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
  hoverRating = signal<number | null>(null);

  // Formulario
  form: FormGroup;

  // Computed para detectar modo
  isEdit = computed(() => !!this.initialData()?.id);

  // Signal para estado de validación
  isFormInvalid = signal<boolean>(false);

  constructor() {
    this.form = this.fb.group({
      id: [''],
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(3)]],
      image: ['', Validators.required],
      star_rating: [null],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.initializeForm(data);
        });
      }
    });

    // Effect para emitir validez del formulario y estado de carga
    effect(() => {
      const isValid = this.form.valid;
      this.formValid.emit(isValid);
      this.isFormInvalid.set(!isValid || this.uploading());
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const isValid = this.form.valid;
        this.formValid.emit(isValid);
        this.isFormInvalid.set(!isValid || this.uploading());
      });
  }

  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.reviews.edit'
      : 'components.reviews.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  private initializeForm(data: any): void {
    this.form.patchValue(data);
    this.id.set(data.id || 0);

    // En modo edición la imagen no es obligatoria ya que puede conservarse la existente en el servidor
    const isEditMode = !!data.id;
    const imageControl = this.form.get('image');
    if (imageControl) {
      if (isEditMode) {
        imageControl.clearValidators();
      } else {
        imageControl.setValidators([Validators.required]);
      }
      imageControl.updateValueAndValidity();
    }

    if (data.photo) {
      this.loadCurrentImage();
    }
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

  private createImagePreview(blob: Blob): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.imageUrl.set(reader.result as string);
    };
    reader.readAsDataURL(blob);
  }

  private setFallbackImage(): void {
    const data = this.initialData();
    this.imageUrl.set(data?.photo || null);
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

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.reviews.error.formInvalid'),
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

    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file, file.name);
    }

    const starRating = this.form.get('star_rating')?.value;
    if (starRating !== null && starRating !== undefined && starRating !== '') {
      formData.append('star_rating', starRating.toString());
    }

    this.uploading.set(true);

    const subscription$ = this.isEdit()
      ? this.srv.patch(formData, this.id())
      : this.srv.post(formData);

    subscription$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.uploading.set(false);
        this.imageUrl.set(null);
        this.form.patchValue({ photo: '' });

        const messageKey = this.isEdit()
          ? 'notifications.reviews.success.updated'
          : 'notifications.reviews.success.created';

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
          this.resetForm();
        }
      },
      error: (error) => {
        this.uploading.set(false);
        this.handleError(error, this.isEdit());
        this.submitError.emit();
      },
    });
  }

  private handleError(error: any, isUpdate: boolean): void {
    if (
      error.status === 400 &&
      error.error.message.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor."The image you are trying to upload is already on the server."',
      )
    ) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.reviews.error.duplicateImage'),
        'error',
      );
    } else {
      const messageKey = isUpdate
        ? 'notifications.reviews.error.update'
        : 'notifications.reviews.error.create';

      this.notificationSrv.addNotification(
        this.transloco.translate(messageKey),
        'error',
      );
    }
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
    this.selectedFile.set(null);
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }

  setRating(rating: number): void {
    const control = this.form.get('star_rating');
    if (control) {
      // Toggle: si el mismo valor, limpiar
      if (control.value === rating) {
        control.setValue(null);
      } else {
        control.setValue(rating);
      }
      this.form.markAsDirty();
    }
  }

  private calculateRatingFromEvent(event: MouseEvent, starIndex: number): number {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const rawVal = starIndex - 1 + ratio;
    return Math.max(0.1, Math.min(5.0, Math.round(rawVal * 10) / 10));
  }

  onStarMouseMove(event: MouseEvent, starIndex: number): void {
    const value = this.calculateRatingFromEvent(event, starIndex);
    this.hoverRating.set(value);
  }

  onStarMouseLeave(): void {
    this.hoverRating.set(null);
  }

  onStarClick(event: MouseEvent, starIndex: number): void {
    const value = this.calculateRatingFromEvent(event, starIndex);
    this.setRating(value);
  }

  /** Devuelve el ancho de relleno de la estrella de 0 a 20 según la puntuación decimal */
  getStarWidth(starIndex: number): number {
    const rating = this.hoverRating() ?? this.form.get('star_rating')?.value ?? 0;
    if (rating >= starIndex) {
      return 20;
    }
    if (rating <= starIndex - 1) {
      return 0;
    }
    const fraction = rating - (starIndex - 1);
    return fraction * 20;
  }
}
