import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../system/config.service';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class CarouselService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      `${this.config.api}carrousel/?no-cache=${timestamp}`,
    );
  }

  getImage(name: string): Observable<Blob> {
    const timestamp = new Date().getTime();
    return this.http.get(
      `${this.config.api_img}${name}/?no-cache=${timestamp}`,
      {
        responseType: 'blob',
      },
    );
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(`${this.config.api}carrousel/`, data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.config.api}carrousel/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.config.api}carrousel/${id}`, {
      body: { id: id },
    });
  }
}
