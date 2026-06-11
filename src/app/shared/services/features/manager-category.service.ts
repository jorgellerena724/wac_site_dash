import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../system/config.service';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class ManagerCategoryService {
  private config = inject(ConfigService);

  constructor(private http: HttpClient) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.config.api + `manager-category/?no-cache=${timestamp}`,
    );
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.config.api + 'manager-category/', data);
  }

  patch(data: any, id: number): Observable<any> {
    return this.http.patch(`${this.config.api}manager-category/${id}`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.config.api}manager-category/${id}`, {
      body: { id: id },
    });
  }
}
