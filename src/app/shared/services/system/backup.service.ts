import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ConfigService } from '../system/config.service';

@Injectable({
  providedIn: 'root',
})
export class BackupService {
  private config = inject(ConfigService);

  // Signals para estados
  public isDownloading = signal<boolean>(false);
  public isRestoring = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  /**
   * Descarga el backup de la base de datos y carpeta uploads
   */
  downloadBackup(): Observable<Blob> {
    this.isDownloading.set(true);
    return this.http
      .get(`${this.config.api}backup/download`, {
        responseType: 'blob',
      })
      .pipe(tap(() => this.isDownloading.set(false)));
  }

  /**
   * Restaura un backup desde un archivo ZIP
   */
  restoreBackup(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    this.isRestoring.set(true);
    return this.http
      .post(`${this.config.api}backup/restore`, formData)
      .pipe(tap(() => this.isRestoring.set(false)));
  }
}
