import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService, DashboardSummary, TopProduit, AlerteProduit } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  summary: DashboardSummary | null = null;
  loading = true;
  today = new Date();
  categoryEntries: { key: string; label: string; count: number; valeur: number; pct: number; color: string }[] = [];

  private catLabels: Record<string, string> = {
    SHW: 'Shawarma', TAC: 'Tacos', PAN: 'Pain', SAU: 'Sauces',
    VIA: 'Viandes', ING: 'Ingrédients', EMB: 'Emballage', PRD: 'Produits',
  };
  private catColors = ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444'];

  constructor(private ds: DashboardService) {}

  ngOnInit(): void {
    this.ds.getSummary().subscribe({
      next: (d) => {
        this.summary = d;
        this.buildCategories(d);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  get greeting(): string {
    const h = this.today.getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  private buildCategories(d: DashboardSummary): void {
    const total = d.valeurStock || 1;
    let i = 0;
    this.categoryEntries = Object.entries(d.categories)
      .sort((a, b) => b[1].valeur - a[1].valeur)
      .map(([key, val]) => ({
        key,
        label: this.catLabels[key] || key,
        count: val.count,
        valeur: val.valeur,
        pct: Math.round((val.valeur / total) * 100),
        color: this.catColors[i++ % this.catColors.length],
      }));
  }

  maxTopValeur(): number {
    if (!this.summary?.topProduits?.length) return 1;
    return this.summary.topProduits[0].valeur || 1;
  }

  pctBar(v: number): number {
    return Math.round((v / this.maxTopValeur()) * 100);
  }
}
