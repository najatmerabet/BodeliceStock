import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PrixClient {
  id?: number;
  clientId: number;
  produitId: number;
  prix: number;
  client?: { id: number; nom: string; ice?: string };
  produit?: { id: number; nom: string; reference: string; prixUnitaire: number; unite: string };
}

export interface PrixResolu {
  prix: number;
  isSpecifique: boolean;
  prixClientId: number | null;
}

@Injectable({ providedIn: 'root' })
export class PrixClientService {
  private apiUrl = '/api/prix-client';

  constructor(private http: HttpClient) {}

  /** Prix spécifiques d'un produit (liste de clients) */
  getByProduit(produitId: number): Observable<PrixClient[]> {
    return this.http.get<PrixClient[]>(`${this.apiUrl}/produit/${produitId}`);
  }

  /** Prix spécifiques d'un client (liste de produits) */
  getByClient(clientId: number): Observable<PrixClient[]> {
    return this.http.get<PrixClient[]>(`${this.apiUrl}/client/${clientId}`);
  }

  /** Résout le prix effectif pour un couple client+produit */
  resolve(clientId: number, produitId: number): Observable<PrixResolu> {
    return this.http.get<PrixResolu>(`${this.apiUrl}/resolve`, {
      params: { clientId: clientId.toString(), produitId: produitId.toString() }
    });
  }

  /** Crée ou met à jour un prix spécifique (upsert) */
  upsert(data: { clientId: number; produitId: number; prix: number }): Observable<PrixClient> {
    return this.http.post<PrixClient>(this.apiUrl, data);
  }

  /** Supprime un prix spécifique */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
