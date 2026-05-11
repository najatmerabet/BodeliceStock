import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BonLivraison } from '../models/bon-livraison.model';

@Injectable({ providedIn: 'root' })
export class BonLivraisonService {
  private api = '/api/bons-livraison';
  constructor(private http: HttpClient) {}

  getAll(): Observable<BonLivraison[]> {
    return this.http.get<BonLivraison[]>(this.api);
  }

  getById(id: number): Observable<BonLivraison> {
    return this.http.get<BonLivraison>(`${this.api}/${id}`);
  }

  create(bl: { clientId: number; lignes: { produitId: number; quantite: number; prix: number }[] }): Observable<BonLivraison> {
    return this.http.post<BonLivraison>(this.api, bl);
  }

  update(id: number, bl: { clientId: number; lignes: any[] }): Observable<BonLivraison> {
    return this.http.put<BonLivraison>(`${this.api}/${id}`, bl);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
