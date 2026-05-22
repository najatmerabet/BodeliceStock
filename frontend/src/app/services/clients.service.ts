import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client } from '../models/clients.model';

@Injectable({
  providedIn: 'root',
})
export class ClientsService {
  private apiurl = '/api/clients';

  constructor(private http: HttpClient) {}

  getClients(): Observable<Client[]> {
    return this.http.get<Client[]>(this.apiurl);
  }
  
  getClient(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiurl}/${id}`);
  }

  addClient(client: Client): Observable<Client> {
    return this.http.post<Client>(this.apiurl, client);
  }
  
  updateClient(ClinetId: number, client: Client): Observable<Client> {
    return this.http.put<Client>(`${this.apiurl}/${ClinetId}`, client);
}

deleteClient(ClientId: number): Observable<any> {
    return this.http.delete(`${this.apiurl}/${ClientId}`);
}
}