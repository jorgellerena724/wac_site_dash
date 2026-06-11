import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../system/config.service';

export interface MetricEvent {
  event_name: string;
  label: string;
}

export interface MetricsConfig {
  id: number;
  user_id: number;
  events: MetricEvent[];
}

export interface ConfigUser {
  // ← para el dropdown
  id: number;
  email: string;
  client: string;
}

export interface DayMetric {
  date: string;
  counters: Record<string, number>;
}

export interface SummaryMetric {
  start_date: string;
  end_date: string;
  days_with_data: number;
  totals: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private urlMetrics = `${this.config.api}metrics`;
  private urlConfig = `${this.config.api}metrics-config`;

  // ── Métricas ──────────────────────────────────────────────
  getToday() {
    return this.http.get<DayMetric>(`${this.urlMetrics}/today/`);
  }

  getServerTime() {
    return this.http.get<{ server_time: string; timezone: string }>(
      `${this.urlMetrics}/server-time/`,
    );
  }

  getRange(startDate: string, endDate: string) {
    const params = new HttpParams()
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get<DayMetric[]>(`${this.urlMetrics}/range/`, { params });
  }

  getSummary(startDate: string, endDate: string) {
    const params = new HttpParams()
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get<SummaryMetric>(`${this.urlMetrics}/summary/`, {
      params,
    });
  }

  getEvents() {
    return this.http.get<{ events: MetricEvent[] }>(
      `${this.urlMetrics}/events/`,
    );
  }

  // ── Config ────────────────────────────────────────────────
  getConfig() {
    return this.http.get<MetricsConfig>(`${this.urlConfig}/user/`);
  }

  getAllConfigs() {
    return this.http.get<MetricsConfig[]>(`${this.urlConfig}/`);
  }

  getUsersWithoutConfig() {
    return this.http.get<any[]>(`${this.urlConfig}/users/`);
  }

  // Crea config con todos los eventos de una vez
  createConfig(data: any): Observable<MetricsConfig> {
    return this.http.post<MetricsConfig>(`${this.urlConfig}/`, data);
  }

  // Sobreescribe el array de eventos completo
  updateEvents(data: any): Observable<MetricsConfig> {
    return this.http.patch<MetricsConfig>(
      `${this.urlConfig}/${data.id}/`,
      data,
    );
  }

  deleteConfig(configId: number): Observable<void> {
    return this.http.delete<void>(`${this.urlConfig}/${configId}/`);
  }
}
