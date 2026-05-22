import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientFolder } from '../models/client-file.model';

@Injectable({ providedIn: 'root' })
export class ClientFoldersService {
  private base = '/api/clients/folders';

  constructor(private http: HttpClient) {}

  getFolders(clientId: number): Observable<ClientFolder[]> {
    return this.http.get<ClientFolder[]>(`${this.base}/${clientId}/folders`);
  }

  createFolder(clientId: number, data: Partial<ClientFolder>): Observable<ClientFolder> {
    return this.http.post<ClientFolder>(`${this.base}/${clientId}/folders`, data);
  }

  updateFolder(clientId: number, id: number, data: Partial<ClientFolder>): Observable<ClientFolder> {
    return this.http.patch<ClientFolder>(`${this.base}/${clientId}/folders/${id}`, data);
  }

  deleteFolder(clientId: number, id: number): Observable<any> {
    return this.http.delete(`${this.base}/${clientId}/folders/${id}`);
  }
}