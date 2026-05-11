import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LigneAvoir {
  id: number;
  produitId: number;
  produit?: any;
  nbUnites?: number;
  poidsUnitaire?: number;
  quantite: number;
  prix: number;
  total: number;
}

export interface FactureAvoir {
  id: number;
  numero: string;
  factureId: number;
  facture?: any;
  date: string;
  total: number;
  motif?: string;
  lignes?: LigneAvoir[];
}

@Injectable({ providedIn: 'root' })
export class AvoirService {
  private api = '/api/avoirs';
  constructor(private http: HttpClient) {}

  getAll(): Observable<FactureAvoir[]> {
    return this.http.get<FactureAvoir[]>(this.api);
  }

  getById(id: number): Observable<FactureAvoir> {
    return this.http.get<FactureAvoir>(`${this.api}/${id}`);
  }

  create(data: { 
    factureId: number; 
    motif?: string; 
    lignes: { 
      produitId: number; 
      nbUnites?: number; 
      poidsUnitaire?: number; 
      quantite: number; 
      prix: number 
    }[] 
  }): Observable<FactureAvoir> {
    return this.http.post<FactureAvoir>(this.api, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
