import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../system/config.service';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private config = inject(ConfigService);

  constructor(private http: HttpClient) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.config.api + `company/?no-cache=${timestamp}`,
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
    return this.http.post<any[]>(this.config.api + 'company/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.config.api}company/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.config.api}company/${id}`, {
      body: { id: id },
    });
  }

  toggleStatus(id: number): Observable<any[]> {
    return this.http.patch<any[]>(`${this.config.api}company/status/${id}`, {
      id: id,
    });
  }
}
