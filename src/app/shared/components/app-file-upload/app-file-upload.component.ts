import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  effect,
  untracked,
  inject,
} from '@angular/core';
import { FileUploadModule } from 'primeng/fileupload';
import { ImageModule } from 'primeng/image';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FileUploadError } from '../../interfaces/fileUpload.interface';
import { CommonModule } from '@angular/common';
import { getLucideIcon } from '../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-file-upload',
  templateUrl: './app-file-upload.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FileUploadModule,
    ImageModule,
    ButtonModule,
    TooltipModule,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFileUploadComponent {
  readonly getIcon = getLucideIcon;
  private transloco = inject(TranslocoService);

  // Inputs
  label = input<string>('Cargar archivo');
  accept = input<string>('image/*');
  maxFileSize = input<number>(2000000);
  fileUploadText = input<string>('Seleccionar archivo');
  fileRecommendation = input<string>(
    'Formato recomendado: PNG o JPG, tamaño máximo 2MB',
  );
  multiple = input<boolean>(false);
  allowedExtensions = input<string[] | undefined>(undefined);

  // Outputs
  fileSelected = output<File[]>();
  fileRemoved = output<void>();
  fileError = output<FileUploadError>();
  fileWarning = output<FileUploadError>();

  // Signals para estado
  selectedFiles = signal<File[]>([]);

  // Mapeo de tipos MIME a extensiones
  private readonly mimeTypeToExtensions: { [key: string]: string[] } = {
    'image/*': ['.jpg', '.jpeg', '.png', '.ico', '.webp'],
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
  };

  // Computed para el valor ajustado de accept
  adjustedAccept = computed(() => {
    const acceptValue = this.accept();
    if (!acceptValue.includes('/') && acceptValue !== '*') {
      if (acceptValue === 'image') {
        return 'image/*';
      } else if (acceptValue === 'video') {
        return 'video/*';
      } else if (acceptValue === 'audio') {
        return 'audio/*';
      }
    }
    return acceptValue;
  });

  // Computed para obtener extensiones permitidas
  allowedExtensionsList = computed(() => {
    const customExts = this.allowedExtensions();
    if (customExts && customExts.length > 0) {
      return customExts;
    }

    const acceptTypes = this.adjustedAccept()
      .split(',')
      .map((t) => t.trim());
    const extensions: string[] = [];

    for (const type of acceptTypes) {
      if (this.mimeTypeToExtensions[type]) {
        extensions.push(...this.mimeTypeToExtensions[type]);
      }
    }

    return [...new Set(extensions)];
  });

  constructor() {
    // Effect para resetear archivos cuando cambian los inputs
    effect(() => {
      // Observar cambios en inputs que deberían resetear los archivos
      this.accept();
      this.maxFileSize();
      this.allowedExtensions();

      untracked(() => {
        this.selectedFiles.set([]);
      });
    });
  }

  onFileSelect(event: any): void {
    if (event.files && event.files.length > 0) {
      const files: File[] = event.files;

      // Validar cada archivo
      for (const file of files) {
        // Validación de tipo de archivo (sigue siendo un error)
        if (!this.isFileTypeValid(file)) {
          const allowedExts = this.allowedExtensionsList();
          const error: FileUploadError = {
            type: 'type',
            message: `Tipo de archivo no válido. Extensiones permitidas: ${allowedExts.join(
              ', ',
            )}`,
            file: file,
          };

          this.fileError.emit(error);
          event.files = [];
          return;
        }

        // Validación de tamaño (ahora es un warning, no un error)
        if (file.size > this.maxFileSize()) {
          const formattedMaxSize = this.formatFileSize(this.maxFileSize());
          const formattedFileSize = this.formatFileSize(file.size);

          const warning: FileUploadError = {
            type: 'size',
            message: this.transloco
              .translate('image.sizeWarning')
              .replace('{fileSize}', formattedFileSize)
              .replace('{maxSize}', formattedMaxSize),
            file: file,
          };

          this.fileWarning.emit(warning);
          // No retornamos aquí, permitimos continuar
        }
      }

      this.selectedFiles.set(files);
      this.fileSelected.emit(files);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
      const kb = bytes / 1024;
      return kb % 1 === 0 ? `${kb} KB` : `${kb.toFixed(1)} KB`;
    } else {
      const mb = bytes / (1024 * 1024);
      return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`;
    }
  }

  private isFileTypeValid(file: File): boolean {
    // Si se especifican extensiones personalizadas, validar solo contra ellas
    const customExts = this.allowedExtensions();
    if (customExts && customExts.length > 0) {
      const fileExtension = this.getFileExtension(file.name).toLowerCase();
      return customExts.includes(`.${fileExtension}`);
    }

    const acceptTypes = this.adjustedAccept()
      .split(',')
      .map((t) => t.trim());
    const fileExtension = this.getFileExtension(file.name).toLowerCase();

    // Verificar si la extensión está permitida
    for (const type of acceptTypes) {
      const extensions = this.mimeTypeToExtensions[type] || [];
      if (extensions.includes(`.${fileExtension}`)) {
        return true;
      }
    }

    // Verificación adicional para tipos MIME
    return acceptTypes.some((type) => {
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return file.type.startsWith(`${category}/`);
      }
      return file.type === type;
    });
  }

  private getFileExtension(filename: string): string {
    return filename
      .slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
      .toLowerCase();
  }

  removeFile(): void {
    this.selectedFiles.set([]);
    this.fileRemoved.emit();
  }

  onClear(): void {
    this.selectedFiles.set([]);
  }
}
