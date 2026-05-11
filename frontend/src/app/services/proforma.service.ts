import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LigneProforma {
  id: number;
  produitId: number;
  produit?: any;
  quantite: number;
  prix: number;
  remise: number;
  tva: number;
  totalAvantRemise: number;
  totalApresRemise: number;
  totalTVA: number;
  totalTTC: number;
}

export interface FactureProforma {
  id: number;
  numero: string;
  clientId: number;
  client?: any;
  date: string;
  totalHT: number;
  totalRemise: number;
  totalTVA: number;
  totalTTC: number;
  statut: string; // BROUILLON | VALIDÉE | FACTURÉE
  lignes?: LigneProforma[];
  bonsLivraison?: any[];
  facture?: any;
}

@Injectable({ providedIn: 'root' })
export class ProformaService {
  private api = '/api/proformas';
  constructor(private http: HttpClient) {}

  getAll(): Observable<FactureProforma[]> {
    return this.http.get<FactureProforma[]>(this.api);
  }

  getById(id: number): Observable<FactureProforma> {
    return this.http.get<FactureProforma>(`${this.api}/${id}`);
  }

  fromBls(blIds: number[]): Observable<FactureProforma> {
    return this.http.post<FactureProforma>(`${this.api}/from-bls`, { blIds });
  }

  updateLignes(id: number, lignes: { id: number; remise: number; tva: number }[]): Observable<FactureProforma> {
    return this.http.put<FactureProforma>(`${this.api}/${id}/lignes`, { lignes });
  }

  valider(id: number): Observable<any> {
    return this.http.put<any>(`${this.api}/${id}/valider`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
