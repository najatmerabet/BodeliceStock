import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private apiUrl = '/api/logs';
    constructor(private http: HttpClient) { }

    getAll(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }

    getLogs(params?: {
      action?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    }): Observable<{ data: any[]; total: number; page: number; pageSize: number; totalPages: number }> {
      let httpParams = new HttpParams();
      
      if (params?.action && params.action !== 'ALL') {
        httpParams = httpParams.set('action', params.action);
      }
      if (params?.startDate) {
        httpParams = httpParams.set('startDate', params.startDate);
      }
      if (params?.endDate) {
        httpParams = httpParams.set('endDate', params.endDate);
      }
      if (params?.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params?.pageSize) {
        httpParams = httpParams.set('pageSize', params.pageSize.toString());
      }
      
      return this.http.get<any>(this.apiUrl, { params: httpParams });
    }

}