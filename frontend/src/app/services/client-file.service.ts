// client-fichiers.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientFile } from '../models/client-file.model';


@Injectable({ providedIn: 'root' })
export class ClientFichiersService {
  private base = 'http://localhost:3000/api/clients/fichiers';

  constructor(private http: HttpClient) {}

  getFichiers(clientId: number): Observable<ClientFile[]> {
    return this.http.get<ClientFile[]>(`${this.base}/${clientId}/fichiers`);
  }

  uploadFichier(clientId: number, formData: FormData): Observable<ClientFile> {
    console.log('Uploading file for client', clientId, formData.get('file'));
    return this.http.post<ClientFile>(`${this.base}/${clientId}/fichiers`, formData);
  }

  updateFichier(clientId: number, id: number, data: Partial<ClientFile>): Observable<ClientFile> {
    return this.http.patch<ClientFile>(`${this.base}/${clientId}/fichiers/${id}`, data);
  }

  deleteFichier(clientId: number, id: number): Observable<any> {
    return this.http.delete(`${this.base}/${clientId}/fichiers/${id}`);
  }

  getDownloadUrl(clientId: number, id: number): string {
    return `${this.base}/${clientId}/fichiers/${id}/download`;
  }
}