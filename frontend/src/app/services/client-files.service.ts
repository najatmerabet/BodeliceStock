import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientFileItem } from '../models/client-file.model';

@Injectable({ providedIn: 'root' })
export class ClientFilesService {
  private base = 'http://localhost:3000/api/clients';

  constructor(private http: HttpClient) {}

  getFiles(clientId: number, folderId?: number | null): Observable<ClientFileItem[]> {
    const params = folderId !== null && folderId !== undefined ? `?folderId=${folderId}` : '';
    return this.http.get<ClientFileItem[]>(`${this.base}/fichiers/${clientId}/files${params}`);
  }

  uploadFile(clientId: number, formData: FormData): Observable<ClientFileItem> {
    return this.http.post<ClientFileItem>(`${this.base}/fichiers/${clientId}/files`, formData);
  }

  updateFile(clientId: number, id: number, data: Partial<ClientFileItem>): Observable<ClientFileItem> {
    return this.http.patch<ClientFileItem>(`${this.base}/fichiers/${clientId}/files/${id}`, data);
  }

  deleteFile(clientId: number, id: number): Observable<any> {
    return this.http.delete(`${this.base}/fichiers/${clientId}/files/${id}`);
  }

  getDownloadUrl(clientId: number, id: number): string {
    return `${this.base}/fichiers/${clientId}/files/${id}/download`;
  }
}