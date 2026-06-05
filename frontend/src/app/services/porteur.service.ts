import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PorteurAffaire {
  id?: number;
  nom: string;
  telephone?: string;
  email?: string;
  clients?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RapportLine {
  date: string;
  blNumero: string;
  clientNom: string;
  produitNom: string;
  nbUnites: number;
  poidsUnitaire: number;
  poids: number;
  prixRestaurant: number;
  montant: number;
  totalFacture: number;
  prixPorteur: number;
  totalPorteur: number;
  avoir: number;
}

export interface RapportCommissions {
  lines: RapportLine[];
  totaux: {
    totalRestaurant: number;
    totalPorteur: number;
    totalAvoir: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class PorteurService {
  private apiurl = '/api/porteurs-affaire';

  constructor(private http: HttpClient) {}

  getPorteurs(): Observable<PorteurAffaire[]> {
    return this.http.get<PorteurAffaire[]>(this.apiurl);
  }

  getPorteur(id: number): Observable<PorteurAffaire> {
    return this.http.get<PorteurAffaire>(`${this.apiurl}/${id}`);
  }

  addPorteur(porteur: PorteurAffaire): Observable<PorteurAffaire> {
    return this.http.post<PorteurAffaire>(this.apiurl, porteur);
  }

  updatePorteur(id: number, porteur: PorteurAffaire): Observable<PorteurAffaire> {
    return this.http.put<PorteurAffaire>(`${this.apiurl}/${id}`, porteur);
  }

  deletePorteur(id: number): Observable<any> {
    return this.http.delete(`${this.apiurl}/${id}`);
  }

  getRapport(id: number, mois?: string): Observable<RapportCommissions> {
    const params: Record<string, string> = {};
    if (mois) {
      params['mois'] = mois;
    }
    return this.http.get<RapportCommissions>(`${this.apiurl}/${id}/rapport`, { params });
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiurl}/categories`);
  }

  getClientCommissions(clientId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiurl}/clients/${clientId}/commissions`);
  }

  saveClientCommissions(clientId: number, commissions: any[]): Observable<any> {
    return this.http.put<any>(`${this.apiurl}/clients/${clientId}/commissions`, commissions);
  }
}
