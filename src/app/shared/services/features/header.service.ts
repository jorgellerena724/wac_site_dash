import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../system/config.service';
import { HeaderData } from '../../interfaces/headerData.interface';

@Injectable({
  providedIn: 'root',
})
export class HeaderService {
  private config = inject(ConfigService);

  constructor(private http: HttpClient) {}

  get(): Observable<HeaderData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HeaderData[]>(
      this.config.api + `header/?no-cache=${timestamp}`,
    );
  }

  getImage(name: string): Observable<Blob> {
    const timestamp = new Date().getTime();
    const url = `${this.config.api_img}${name}/?no-cache=${timestamp}`;
    return this.http.get(url, {
      responseType: 'blob',
    });
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.config.api + 'header/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.config.api}header/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.config.api}header/${id}`, {
      body: { id: id },
    });
  }
}
