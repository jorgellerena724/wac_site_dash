import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.api_users;

  // Signal para cachear datos
  private dataSignal = signal<any[] | null>(null);
  public data = computed(() => this.dataSignal());
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  get(): Observable<any[]> {
    const cached = this.dataSignal();
    if (cached) {
      return of(cached);
    }

    this.isLoading.set(true);
    return this.http.get<any[]>(this.apiUrl).pipe(
      tap((data) => {
        this.dataSignal.set(data);
        this.isLoading.set(false);
      })
    );
  }

  post(data: any): Observable<any[]> {
    return this.http
      .post<any[]>(this.apiUrl, data)
      .pipe(tap(() => this.invalidateCache()));
  }

  patch(data: any): Observable<any[]> {
    return this.http
      .patch<any[]>(this.apiUrl + data.id, data)
      .pipe(tap(() => this.invalidateCache()));
  }

  delete(id: number): Observable<any> {
    return this.http
      .delete<any>(this.apiUrl + id, {
        body: { id: id },
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  changePassword(data: any): Observable<any> {
    return this.http
      .patch<any[]>(this.apiUrl + data.id, {
        newPassword: data.newPassword,
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
