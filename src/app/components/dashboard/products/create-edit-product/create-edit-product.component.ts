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
  PLATFORM_ID,
  computed,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
  FormControl,
} from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { CategoryService } from '../../../../shared/services/features/category.service';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { ProductService } from '../../../../shared/services/features/product.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

interface ProductVariant {
  description: string;
  price: number;
}

interface ProductFile {
  file: File | null;
  title: string;
  previewUrl: string | null;
  videoUrl: SafeResourceUrl | null;
  isVideo: boolean;
  isExisting?: boolean;
  existingPath?: string;
}

@Component({
  selector: 'app-create-edit-product',
  templateUrl: './create-edit-product.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    SelectComponent,
    TranslocoModule,
    TooltipModule,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditProductComponent implements DynamicComponent {
  // Array de clientes permitidos para ver el campo cal_url
  private readonly ALLOWED_CLIENTS_FOR_CAL_URL = ['shirkasoft', 'breeze'];

  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ProductService);
  private notificationSrv = inject(NotificationService);
  private categorySrv = inject(CategoryService);
  private transloco = inject(TranslocoService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  uploading = signal<boolean>(false);
  loadingImage = signal<boolean>(false);
  showCalUrlField = signal<boolean>(false);
  categories = signal<any[]>([]);

  // Signals para archivos múltiples
  productFiles = signal<ProductFile[]>([]);

  // Signals para variantes
  variants = signal<ProductVariant[]>([]);

  // Form Arrays
  filesFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);
  variantsFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  // Formulario
  form: FormGroup;

  // Computed para detectar modo
  isEdit = computed(() => !!this.initialData()?.id);

  // Computed para facilitar acceso en template
  isFormInvalidComputed = signal<boolean>(false);

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      cal_url: [''],
      category: ['', Validators.required],
      description: [''],
      files: this.filesFormArray,
      variants: this.variantsFormArray,
    });

    this.filesFormArray.setErrors({ required: true });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);

          if (this.isEdit()) {
            this.form.get('category')?.setValue(data.category?.id);
            this.id.set(data.id || 0);

            // Cargar variantes existentes
            if (data.variants) {
              this.loadVariantsFromData(data.variants);
            }

            // Cargar archivos existentes
            if (data.files && Array.isArray(data.files)) {
              this.loadExistingFiles(data.files);
            }
          } else {
            // En modo crear, solo establecer el id en 0
            this.id.set(0);
          }

          if (
            data.variants &&
            typeof data.variants === 'object' &&
            !this.isEdit()
          ) {
            this.loadVariantsFromData(data.variants);
          }
        });
      }
    });

    // Effect para inicializar
    effect(() => {
      this.initShowCalUrlField();
      this.fetchCategories();
    });

    // Effect para actualizar isFormInvalidComputed
    effect(() => {
      const invalid =
        this.form.invalid ||
        this.uploading() ||
        this.productFiles().length === 0;
      this.isFormInvalidComputed.set(invalid);
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
      ? 'components.products.edit'
      : 'components.products.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  private initShowCalUrlField(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const userString = localStorage.getItem('user');
      if (userString) {
        const user = JSON.parse(userString);
        const client = user?.client;

        // Verificar si el usuario está en la lista de clientes permitidos
        const isAllowed = this.ALLOWED_CLIENTS_FOR_CAL_URL.some(
          (allowedClient) =>
            client.toLowerCase().includes(allowedClient.toLowerCase()),
        );

        this.showCalUrlField.set(isAllowed);
      } else {
        this.showCalUrlField.set(false);
      }
    } catch (error) {
      console.error('Error al leer usuario del localStorage:', error);
      this.showCalUrlField.set(false);
    }
  }

  // Cargar archivos existentes desde los datos del producto
  private loadExistingFiles(filesData: any[]): void {
    filesData.forEach((fileData, index) => {
      const isVideo = this.isVideoFile(fileData.media);

      const productFile: ProductFile = {
        file: null,
        title: fileData.title || '',
        previewUrl: null,
        videoUrl: null,
        isVideo,
        isExisting: true,
        existingPath: fileData.media,
      };

      this.productFiles.update((files) => [...files, productFile]);
      this.addFileToFormArray(productFile.title, null);

      // Cargar preview del archivo existente
      this.loadExistingFilePreview(productFile, index);
    });
  }

  private loadExistingFilePreview(
    productFile: ProductFile,
    index: number,
  ): void {
    if (productFile.existingPath) {
      this.loadingImage.set(true);

      this.srv
        .getImage(productFile.existingPath)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (blob: Blob) => {
            if (productFile.isVideo) {
              this.createVideoPreview(
                blob,
                productFile.existingPath?.split('.').pop(),
                index,
              );
            } else {
              this.createImagePreview(blob, index);
            }
            this.loadingImage.set(false);
          },
          error: () => {
            if (productFile.isVideo) {
              this.setFallbackVideo(productFile.existingPath!, index);
            } else {
              this.setFallbackImage(productFile.existingPath!, index);
            }
            this.loadingImage.set(false);
          },
        });
    }
  }

  private isVideoFile(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov'].includes(extension || '');
  }

  // Métodos para manejar archivos múltiples
  onFileUploaded(files: FileList | File[]): void {
    const filesArray = files instanceof FileList ? Array.from(files) : files;

    filesArray.forEach((file) => {
      const supportedVideoTypes = [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
      ];

      const isVideo = supportedVideoTypes.includes(file.type);

      if (isVideo) {
        const videoObjectUrl = URL.createObjectURL(file);
        const videoUrl =
          this.sanitizer.bypassSecurityTrustResourceUrl(videoObjectUrl);

        const productFile: ProductFile = {
          file,
          title: '',
          previewUrl: null,
          videoUrl,
          isVideo,
          isExisting: false,
        };

        this.productFiles.update((files) => [...files, productFile]);
        this.addFileToFormArray(productFile.title, file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const previewUrl = reader.result as string;

          const productFile: ProductFile = {
            file,
            title: '',
            previewUrl,
            videoUrl: null,
            isVideo: false,
            isExisting: false,
          };

          this.productFiles.update((files) => [...files, productFile]);
          this.addFileToFormArray(productFile.title, file);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  private addFileToFormArray(title: string, file: File | null): void {
    const fileGroup = this.fb.group({
      title: [title],
      file: [file],
    });
    this.filesFormArray.push(fileGroup);

    if (this.filesFormArray.length > 0) {
      this.filesFormArray.setErrors(null);
    }
  }

  removeFile(index: number): void {
    const currentFiles = this.productFiles();
    const fileToRemove = currentFiles[index];

    // Limpiar URLs
    if (
      fileToRemove.previewUrl &&
      fileToRemove.previewUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    if (fileToRemove.videoUrl) {
      const unsafeUrl = fileToRemove.videoUrl as any;
      if (unsafeUrl.changingThisBreaksApplicationSecurity) {
        URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
      }
    }

    // Remover de arrays
    this.productFiles.update((files) => {
      const newFiles = [...files];
      newFiles.splice(index, 1);
      return newFiles;
    });
    this.filesFormArray.removeAt(index);

    if (this.productFiles().length === 0) {
      this.filesFormArray.setErrors({ required: true });
      this.filesFormArray.markAsTouched();
    }
  }

  // Métodos para reordenar archivos
  moveFileUp(index: number): void {
    if (index === 0) return;

    this.productFiles.update((files) => {
      const newFiles = [...files];
      const temp = newFiles[index];
      newFiles[index] = newFiles[index - 1];
      newFiles[index - 1] = temp;
      return newFiles;
    });

    const control = this.filesFormArray.at(index);
    this.filesFormArray.removeAt(index);
    this.filesFormArray.insert(index - 1, control);
  }

  moveFileDown(index: number): void {
    const currentFiles = this.productFiles();
    if (index === currentFiles.length - 1) return;

    this.productFiles.update((files) => {
      const newFiles = [...files];
      const temp = newFiles[index];
      newFiles[index] = newFiles[index + 1];
      newFiles[index + 1] = temp;
      return newFiles;
    });

    const control = this.filesFormArray.at(index);
    this.filesFormArray.removeAt(index);
    this.filesFormArray.insert(index + 1, control);
  }

  getFileControl(index: number, field: string): FormControl {
    const fileGroup = this.filesFormArray.at(index) as FormGroup;
    return fileGroup.get(field) as FormControl;
  }

  // Métodos para variantes
  addVariant(): void {
    const variantGroup = this.fb.group({
      description: ['', Validators.required],
      price: ['', Validators.min(0)],
    });

    this.variantsFormArray.push(variantGroup);
    this.variants.update((variants) => [
      ...variants,
      { description: '', price: 0 },
    ]);
  }

  removeVariant(index: number): void {
    this.variantsFormArray.removeAt(index);
    this.variants.update((variants) => {
      const newVariants = [...variants];
      newVariants.splice(index, 1);
      return newVariants;
    });
  }

  getVariantControl(index: number, field: string): FormControl {
    const variantGroup = this.variantsFormArray.at(index) as FormGroup;
    return variantGroup.get(field) as FormControl;
  }

  private loadVariantsFromData(variantsData: any): void {
    if (Array.isArray(variantsData)) {
      this.variants.set([]);
      this.variantsFormArray.clear();

      const newVariants: ProductVariant[] = [];

      variantsData.forEach((variant: any) => {
        const variantGroup = this.fb.group({
          description: [variant.description || '', Validators.required],
          price: [variant.price || 0, Validators.min(0)],
        });

        this.variantsFormArray.push(variantGroup);
        newVariants.push({
          description: variant.description || '',
          price: variant.price || 0,
        });
      });

      this.variants.set(newVariants);
    } else if (variantsData && typeof variantsData === 'object') {
      const variantsArray = variantsData.variants || [];
      if (Array.isArray(variantsArray)) {
        this.variants.set([]);
        this.variantsFormArray.clear();

        const newVariants: ProductVariant[] = [];

        variantsArray.forEach((variant: any) => {
          const variantGroup = this.fb.group({
            description: [
              variant.value || variant.description || '',
              Validators.required,
            ],
            price: [variant.price || 0, Validators.min(0)],
          });

          this.variantsFormArray.push(variantGroup);
          newVariants.push({
            description: variant.value || variant.description || '',
            price: variant.price || 0,
          });
        });

        this.variants.set(newVariants);
      }
    }
  }

  private getVariantsData(): ProductVariant[] {
    const variantsData: ProductVariant[] = [];
    for (let i = 0; i < this.variantsFormArray.length; i++) {
      const variantGroup = this.variantsFormArray.at(i) as FormGroup;
      variantsData.push({
        description: variantGroup.get('description')?.value,
        price: parseFloat(variantGroup.get('price')?.value),
      });
    }
    return variantsData;
  }

  // Métodos para preview de archivos existentes
  private createVideoPreview(
    blob: Blob,
    extension: string | undefined,
    index: number,
  ): void {
    let mimeType = 'video/mp4';
    if (extension === 'mov') mimeType = 'video/quicktime';
    if (extension === 'webm') mimeType = 'video/webm';
    if (extension === 'ogg') mimeType = 'video/ogg';

    const videoBlob = new Blob([blob], { type: mimeType });
    const videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      URL.createObjectURL(videoBlob),
    );

    this.productFiles.update((files) => {
      const newFiles = [...files];
      newFiles[index].videoUrl = videoUrl;
      return newFiles;
    });
  }

  private setFallbackVideo(videoPath: string, index: number): void {
    const videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(videoPath);

    this.productFiles.update((files) => {
      const newFiles = [...files];
      newFiles[index].videoUrl = videoUrl;
      return newFiles;
    });
  }

  private createImagePreview(blob: Blob, index: number): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.productFiles.update((files) => {
        const newFiles = [...files];
        newFiles[index].previewUrl = reader.result as string;
        return newFiles;
      });
    };
    reader.readAsDataURL(new Blob([blob]));
  }

  private setFallbackImage(imagePath: string, index: number): void {
    this.productFiles.update((files) => {
      const newFiles = [...files];
      newFiles[index].previewUrl = imagePath;
      return newFiles;
    });
  }

  async onSubmit(): Promise<void> {
    const currentFiles = this.productFiles();

    if (this.form.invalid || currentFiles.length === 0) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning',
      );

      this.filesFormArray.setErrors(
        currentFiles.length === 0 ? { required: true } : null,
      );
      this.filesFormArray.markAsTouched();

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    const calUrlValue = this.form.get('cal_url')?.value;
    formData.append(
      'cal_url',
      calUrlValue && calUrlValue.trim() ? calUrlValue.trim() : '',
    );

    // Preservar saltos de línea en la descripción
    const description = this.form.get('description')?.value || '';
    const processedDescription = description
      ? description
          .split('\n')
          .map((line: string) => line.trimEnd())
          .join('\n')
          .replace(/^\s+/, '')
          .replace(/\s+$/, '')
      : '';
    formData.append('description', processedDescription);
    formData.append('category_id', this.form.get('category')?.value);

    // Agregar variants como JSON
    const variantsData = this.getVariantsData();
    formData.append('variants', JSON.stringify(variantsData));

    if (this.isEdit()) {
      // Lógica de actualización: separar archivos existentes y nuevos
      const existingFiles = currentFiles.filter((file) => file.isExisting);
      const newFiles = currentFiles.filter(
        (file) => !file.isExisting && file.file,
      );

      // Enviar información de archivos existentes que deben mantenerse
      const existingFilesData = existingFiles.map((file) => ({
        path: file.existingPath,
        title:
          this.filesFormArray.at(currentFiles.indexOf(file)).get('title')
            ?.value || '',
      }));
      formData.append('existing_files', JSON.stringify(existingFilesData));

      // Agregar títulos de archivos nuevos
      const newFileTitles = newFiles.map((file) => {
        const index = currentFiles.indexOf(file);
        return this.filesFormArray.at(index).get('title')?.value || '';
      });
      formData.append('file_titles', JSON.stringify(newFileTitles));

      // Agregar archivos nuevos
      newFiles.forEach((productFile) => {
        if (productFile.file) {
          formData.append('files', productFile.file, productFile.file.name);
        }
      });
    } else {
      // Lógica de creación: agregar todos los archivos
      const fileTitles = this.filesFormArray.controls.map(
        (control) => control.get('title')?.value || '',
      );
      formData.append('file_titles', JSON.stringify(fileTitles));

      currentFiles.forEach((productFile) => {
        if (productFile.file) {
          formData.append('files', productFile.file, productFile.file.name);
        }
      });
    }

    this.uploading.set(true);

    const subscription$ = this.isEdit()
      ? this.srv.patch(formData, this.id())
      : this.srv.post(formData);

    subscription$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.uploading.set(false);
        const messageKey = this.isEdit()
          ? 'notifications.products.success.updated'
          : 'notifications.products.success.created';

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
      isUpdate &&
      error.status === 400 &&
      error.error.message?.includes('imagen') &&
      error.error.message?.includes('servidor')
    ) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.duplicateImage'),
        'error',
      );
    } else {
      const messageKey = isUpdate
        ? 'notifications.products.error.update'
        : 'notifications.products.error.create';

      this.notificationSrv.addNotification(
        this.transloco.translate(messageKey),
        'error',
      );
    }
  }

  get isFormInvalid(): boolean {
    return (
      this.form.invalid || this.uploading() || this.productFiles().length === 0
    );
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  fetchCategories(): void {
    this.categorySrv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.categories.set(
            data.map((com: any) => ({
              value: com.id,
              label: com.title,
            })),
          );
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.categories.error.load'),
            'error',
          );
        },
      });
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
  }

  onFileWarning(warning: FileUploadError): void {
    this.notificationSrv.addNotification(warning.message, 'warning');
  }

  onVideoLoaded(event: Event, videoPlayer: HTMLVideoElement): void {
    videoPlayer.muted = true;
    videoPlayer.playsInline = true;
    videoPlayer.play().catch(() => {});
  }

  private resetForm(): void {
    if (this.isEdit()) {
      // Mantener solo archivos existentes
      const currentFiles = this.productFiles();
      const newFiles = currentFiles.filter((file) => !file.isExisting);

      // Limpiar URLs de archivos nuevos
      newFiles.forEach((file) => {
        if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
        if (file.videoUrl) {
          const unsafeUrl = file.videoUrl as any;
          if (unsafeUrl.changingThisBreaksApplicationSecurity) {
            URL.revokeObjectURL(
              unsafeUrl.changingThisBreaksApplicationSecurity,
            );
          }
        }
      });

      const existingFiles = currentFiles.filter((file) => file.isExisting);
      this.productFiles.set(existingFiles);

      this.filesFormArray.clear();
      existingFiles.forEach((file) => {
        this.addFileToFormArray(file.title, null);
      });

      this.variants.set([]);
      this.variantsFormArray.clear();
    } else {
      // En modo crear, limpiar todo
      this.form.reset();

      const currentFiles = this.productFiles();
      currentFiles.forEach((file) => {
        if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
        if (file.videoUrl) {
          const unsafeUrl = file.videoUrl as any;
          if (unsafeUrl.changingThisBreaksApplicationSecurity) {
            URL.revokeObjectURL(
              unsafeUrl.changingThisBreaksApplicationSecurity,
            );
          }
        }
      });

      this.productFiles.set([]);
      this.filesFormArray.clear();
      this.filesFormArray.setErrors({ required: true });
      this.variants.set([]);
      this.variantsFormArray.clear();
    }
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}
