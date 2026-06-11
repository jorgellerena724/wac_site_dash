import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../system/config.service';
import { ContactData } from '../../interfaces/contact.interface';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private config = inject(ConfigService);

  constructor(private http: HttpClient) {}

  get(): Observable<ContactData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<ContactData[]>(
      this.config.api + `contact/?no-cache=${timestamp}`,
    );
  }

  patch(formData: any, id: number): Observable<any> {
    return this.http.patch(`${this.config.api}contact/${id}`, formData);
  }
}
