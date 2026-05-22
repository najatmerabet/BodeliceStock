import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiUrlUsine = '/api/stock-usine';
  private apiUrlProd = '/api/production';

  constructor(private http: HttpClient) { }

  getStockUsine(dateDebut?: string, dateFin?: string): Observable<any[]> {
    let params = new HttpParams();
    if (dateDebut) params = params.set('dateDebut', dateDebut);
    if (dateFin) params = params.set('dateFin', dateFin);
    return this.http.get<any[]>(this.apiUrlUsine, { params });
  }

  getProduction(dateDebut?: string, dateFin?: string): Observable<any> {
    let params = new HttpParams();
    if (dateDebut) params = params.set('dateDebut', dateDebut);
    if (dateFin) params = params.set('dateFin', dateFin);
    return this.http.get<any>(this.apiUrlProd, { params });
  }

  addEntreeStock(produitId: number, quantite: number, date?: string): Observable<any> {
    const body: any = { produitId, quantite };
    if (date) body.date = date;
    return this.http.post<any>(`${this.apiUrlProd}/entree`, body);
  }
}
