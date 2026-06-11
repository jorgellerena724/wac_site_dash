export interface FileUploadError {
  type: 'size' | 'type';
  message: string;
  file: File;
}
