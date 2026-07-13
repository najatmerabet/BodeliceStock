import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Paiement {
  id: number;
  montant: number;
  methode: string;
  date: string;
  remarque?: string;
}

export interface LigneHistorique {
  produitId: number;
  quantite: number;
  prix: number;
  remise?: number;
  tva?: number;
  nbUnites?: number | null;
  poidsUnitaire?: number | null;
}

export interface CreateHistoriquePayload {
  clientId: number;
  date?: string;
  referenceExterne?: string;
  paye?: number;
  lignes?: LigneHistorique[];
  totalManuel?: number;
}

export interface Facture {
  id: number;
  numero: string;
  clientId: number;
  client?: any;
  date: string;
  totalHT?: number;
  totalTVA?: number;
  totalRemise?: number;
  total: number;
  paye: number;
  reste: number;
  statut: string;
  type?: string;
  referenceExterne?: string;
  bonsLivraison?: any[];
  avoirs?: any[];
  lignes?: any[];
  paiements?: Paiement[];
}

@Injectable({
  providedIn: 'root'
})
export class FactureService {
  private apiUrl = '/api/factures';

  constructor(private http: HttpClient) { }

  getAll(): Observable<Facture[]> {
    return this.http.get<Facture[]>(this.apiUrl);
  }

  getById(id: number): Observable<Facture> {
    return this.http.get<Facture>(`${this.apiUrl}/${id}`);
  }

  generateFromBls(blIds: number[]): Observable<Facture> {
    return this.http.post<Facture>(`${this.apiUrl}/generate-from-bls`, { blIds });
  }

  createManual(data: any): Observable<Facture> {
    return this.http.post<Facture>(this.apiUrl, data);
  }

  payer(id: number, montant: number, methode: string = 'ESPECE', remarque?: string): Observable<Facture> {
    return this.http.put<Facture>(`${this.apiUrl}/${id}/payer`, { montant, methode, remarque });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  createHistorique(payload: CreateHistoriquePayload): Observable<Facture> {
    return this.http.post<Facture>(`${this.apiUrl}/historique`, payload);
  }

  getReleveClient(clientId: number, dateFrom?: string, dateTo?: string): Observable<any> {
    let url = `${this.apiUrl}/releve/${clientId}`;
    const params: string[] = [];
    if (dateFrom) params.push(`dateFrom=${dateFrom}`);
    if (dateTo) params.push(`dateTo=${dateTo}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<any>(url);
  }
}
