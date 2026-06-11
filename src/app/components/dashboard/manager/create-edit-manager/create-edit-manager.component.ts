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
import { ManagerService } from '../../../../shared/services/features/manager.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { ManagerCategoryService } from '../../../../shared/services/features/manager-category.service';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-create-edit-manager',
  templateUrl: './create-edit-manager.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
    SelectComponent,
    TooltipModule,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditManagerComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ManagerService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private categorySrv = inject(ManagerCategoryService);
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
  categories = signal<any[]>([]);

  // Formulario
  form: FormGroup;

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  // Computed para modo (create vs edit)
  isEdit = computed(() => !!this.initialData()?.id);

  // Mensajes
  formInvalidMessage = computed(() =>
    this.transloco.translate('notifications.managers.error.formInvalid'),
  );

  createdMessage = computed(() =>
    this.transloco.translate('notifications.managers.success.created'),
  );

  createErrorMessage = computed(() =>
    this.transloco.translate('notifications.managers.error.create'),
  );

  updatedMessage = computed(() =>
    this.transloco.translate('notifications.managers.success.updated'),
  );

  updateErrorMessage = computed(() =>
    this.transloco.translate('notifications.managers.error.update'),
  );

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      charge: ['', [Validators.required, Validators.minLength(3)]],
      manager_category: [''],
      description: [''],
      image: [''],
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

    // Effect para cargar categorías
    effect(() => {
      this.fetchCategories();
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid);
    });

    // Suscripción a cambios de categoría para re-validar el nombre
    this.form
      .get('manager_category')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.get('title')?.updateValueAndValidity();
      });
  }

  private initializeForm(data: any): void {
    const formData = { ...data };

    // Determinar el valor de la categoría
    if (formData.manager_category?.id) {
      formData.manager_category = formData.manager_category.id;
    } else if (
      formData.manager_category_id !== null &&
      formData.manager_category_id !== undefined &&
      formData.manager_category_id !== ''
    ) {
      formData.manager_category = formData.manager_category_id;
    } else if (formData.manager_category === undefined) {
      formData.manager_category = null;
    }

    this.id.set(data.id || 0);
    this.form.patchValue(formData);

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

  onFileSelected(file: File): void {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
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
    this.imageUrl.set(data?.photo || null);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.formInvalidMessage(),
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

    formData.append('charge', this.form.get('charge')?.value);

    // Get manager_category value
    const categoryId = this.form.get('manager_category')?.value;
    const hadCategoryBefore =
      this.initialData()?.manager_category_id ||
      this.initialData()?.manager_category?.id;

    if (!this.isEdit()) {
      // Create logic
      if (
        categoryId !== null &&
        categoryId !== undefined &&
        categoryId !== '' &&
        categoryId !== 'null'
      ) {
        formData.append('manager_category_id', categoryId.toString());
      }
    } else {
      // Update logic
      const wantsToRemoveCategory =
        hadCategoryBefore &&
        (categoryId === null ||
          categoryId === undefined ||
          categoryId === '' ||
          categoryId === 'null');

      if (wantsToRemoveCategory) {
        formData.append('remove_manager_category', 'true');
      } else if (
        categoryId !== null &&
        categoryId !== undefined &&
        categoryId !== '' &&
        categoryId !== 'null' &&
        !isNaN(Number(categoryId)) &&
        Number(categoryId) > 0
      ) {
        formData.append('manager_category_id', categoryId.toString());
      }
    }

    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file, file.name);
    } else if (this.imageUrl() === null && this.initialData()?.photo) {
      // if previously had photo but now removed
      formData.append('remove_photo', 'true');
    }

    this.uploading.set(true);

    if (!this.isEdit()) {
      this.srv
        .post(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.uploading.set(false);
            this.imageUrl.set(null);
            this.form.patchValue({ photo: '' });

            this.notificationSrv.addNotification(
              this.createdMessage(),
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
            this.handleError(error, false);
            this.submitError.emit();
          },
        });
    } else {
      this.srv
        .patch(formData, this.id())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.uploading.set(false);
            this.imageUrl.set(null);
            this.form.patchValue({ photo: '' });

            this.notificationSrv.addNotification(
              this.updatedMessage(),
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
            this.handleError(error, true);
            this.submitError.emit();
          },
        });
    }
  }

  private handleError(error: any, isUpdate: boolean): void {
    if (
      error.status === 400 &&
      error.error.message.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor."The image you are trying to upload is already on the server."',
      )
    ) {
      this.notificationSrv.addNotification(error.error.message, 'error');
    } else {
      this.notificationSrv.addNotification(
        isUpdate ? this.updateErrorMessage() : this.createErrorMessage(),
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

  private fetchCategories(): void {
    this.transloco
      .selectTranslate('components.managers.create.no_category')
      .pipe(
        switchMap((noCategoryLabel) =>
          this.categorySrv
            .get()
            .pipe(map((data) => ({ noCategoryLabel, data }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ noCategoryLabel, data }) => {
          this.categories.set([
            { value: null, label: noCategoryLabel },
            ...data.map((com: any) => ({
              value: com.id,
              label: com.title,
            })),
          ]);
        },
        error: (err) => {
          const message = this.transloco.translate(
            'notifications.publication-category.error.load',
          );
          this.notificationSrv.addNotification(message, 'error');
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  // Helper para traducciones dinámicas en template
  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.managers.edit'
      : 'components.managers.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}
