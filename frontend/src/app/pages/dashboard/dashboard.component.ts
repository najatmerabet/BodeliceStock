import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {

  today = new Date();
  stats: any[] = [];



  // ── Line chart ───────────────────────────────────────────────────────────
  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Revenus (DH)',
      borderColor: '#185FA5',
      backgroundColor: 'rgba(24,95,165,0.07)',
      borderWidth: 2.5,
      pointBackgroundColor: '#185FA5',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: true,
      tension: 0.4,
    }],
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }, color: '#AAB4C4' },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)', drawTicks: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
          color: '#AAB4C4',
          padding: 10,
          callback: (v) => {
            const value = Number(v);
            return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
          },
        },
      },
    },
  };

  // ── Donut chart ──────────────────────────────────────────────────────────
  donutChartData: ChartData<'doughnut'> = {
    labels: ['payée', 'impayée'],
    datasets: [{
      data: [],
      backgroundColor: ['#639922', '#BA7517'],
      borderWidth: 3,
      borderColor: '#fff',
      hoverOffset: 6,
    }],
  };
  donutLegend: any[] = [];
  donutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
   
    plugins: { legend: { display: false } },
  };

  // ── Bar chart ────────────────────────────────────────────────────────────
  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'kg vendus',
      backgroundColor: 'rgba(24,95,165,0.12)',
      borderColor: '#185FA5',
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }, color: '#AAB4C4' },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)', drawTicks: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
          color: '#AAB4C4',
          padding: 10,
        },
      },
    },
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.dashboardService.getSummary().subscribe({
      next: (data: any) => {
        this.updateStats(data);
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error(err),
    });
  }

  updateStats(data: any): void {
    const totalRevenus = data.revenusParMois?.reduce(
      (sum: number, item: any) => sum + Number(item.montant), 0
    ) || 0;

    this.stats = [
      { icon: 'inventory_2',    label: 'Produits',         value: data.produits,                    color: '#2E7D32', bg: '#E8F5E9' },
      { icon: 'groups',         label: 'Clients',          value: data.clients,                     color: '#1565C0', bg: '#E3F2FD' },
      { icon: 'receipt_long',   label: 'Factures',         value: data.factures,                    color: '#C62828', bg: '#FFEBEE' },
      { icon: 'local_shipping', label: 'Livraisons',       value: data.livraisons,                  color: '#E65100', bg: '#FFF3E0' },
      { icon: 'payments',       label: 'Revenus mensuels', value: totalRevenus.toFixed(0) + ' DH',  color: '#6A1B9A', bg: '#F3E5F5' },
      { icon: 'inventory',      label: 'Stock total',      value: data.totalNb + ' NB',             color: '#00695C', bg: '#E0F2F1' },
      { icon: 'scale',          label: 'Poids total',      value: data.poidsTotal + ' kg',           color: '#37474F', bg: '#ECEFF1' },
    ];

    if (data.revenusParMois?.length) {
      this.lineChartData = {
        ...this.lineChartData,
        labels: data.revenusParMois.map((i: any) =>
          new Date(i.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        ),
        datasets: [{
          ...this.lineChartData.datasets[0],
          data: data.revenusParMois.map((i: any) => Number(i.montant)),
        }],
      };
    }

  if (data.livraisonsParStatut?.length) {
  const labels = data.livraisonsParStatut.map((x: any) => x.statut);
  const values = data.livraisonsParStatut.map((x: any) => x._count);
  const total = values.reduce((a: number, b: number) => a + b, 0);
  const pct = (v: number) => total ? Math.round((v / total) * 100) : 0;
  const normalize = (s: string) =>
  s.normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .trim()
   .toUpperCase();
  const colorMap: any = {
  'PAYEE': '#639922',
  'IMPAYEE': '#BA7517',
};

this.donutLegend = labels.map((label: string, i: number) => {
  const key = normalize(label);

  return {
    label,
    value: pct(values[i]),
    color: colorMap[key] || '#ccc',
  };
});

this.donutChartData = {
  labels,
  datasets: [{
    data: values,
    backgroundColor: labels.map((l: string) => {
      const key = normalize(l);
      return colorMap[key] || '#ccc';
    }),
    borderWidth: 3,
    borderColor: '#fff',
  }],
};
} else {
  // ✅ RESET propre
  this.donutLegend = [];
  this.donutChartData = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderWidth: 3,
      borderColor: '#fff',
    }],
  };
}

    if (data.topProduits?.length) {
      this.barChartData = {
        ...this.barChartData,
        labels: data.topProduits.map((p: any) => p.nom),
        datasets: [{
          ...this.barChartData.datasets[0],
          data: data.topProduits.map((p: any) => p.quantite),
        }],
      };
    }
  }
}