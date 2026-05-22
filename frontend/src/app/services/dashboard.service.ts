import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TopProduit {
  id: number;
  reference: string;
  nom: string;
  unite: string;
  quantite: number;
  poidsUnitaire: number;
  prixUnitaire: number;
  valeur: number;
}

export interface AlerteProduit {
  id: number;
  reference: string;
  nom: string;
  quantite: number;
  unite: string;
}

export interface DashboardSummary {
  produits: number;
  clients: number;
  livraisons: number;
  factures: number;
  stockFaible: number;
  valeurStock: number;
  totalNb: number;
  poidsTotal: number;
  proformas: number;
  avoirs: number;
  topProduits: TopProduit[];
  alertes: AlerteProduit[];
  categories: Record<string, { count: number; valeur: number }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/dashboard/summary');
  }
}
