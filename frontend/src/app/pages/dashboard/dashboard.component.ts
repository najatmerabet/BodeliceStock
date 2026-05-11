import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProduitService } from '../../services/produit.service';
import { ClientsService } from '../../services/clients.service';
import { ChangeDetectorRef } from '@angular/core';
import { DashboardService } from '../../services/dashbordservice';
import { BaseChartDirective } from 'ng2-charts';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  ProduitsCount = 0;
  ClientsCount = 0;
  stats: any[] = [];
  constructor(private produitService: ProduitService, private clientsService: ClientsService, private cdr: ChangeDetectorRef, private dashboardService: DashboardService) {
    this.loadStats();
  }

 loadStats(): void {
  this.dashboardService.getStats().subscribe({
   
    next: (data) => {
      this.updateStats(data);
      this.cdr.detectChanges();
      console.log('Statistiques chargées :', data);
    },
    error: (err) => console.error(err)
  });
 
}
lineChartData: any = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Revenus (DH)',
      borderColor: '#6A1B9A',
      backgroundColor: 'rgba(106,27,154,0.2)',
      fill: true,
      tension: 0.4
    }
  ]
};

lineChartOptions: any = {
  responsive: true,
  plugins: {
    legend: {
      display: true
    }
  }
};

updateStats(data: any): void {

  // ✅ tes stats (déjà correct)
  this.stats = [
    {
      icon: 'inventory_2',
      label: 'Produits',
      value: data.produits,
      color: '#2E7D32',
      bg: '#E8F5E9'
    },
    {
      icon: 'groups',
      label: 'Clients',
      value: data.clients,
      color: '#1565C0',
      bg: '#E3F2FD'
    },
    {
      icon: 'receipt_long',
      label: 'Factures',
      value: data.factures,
      color: '#C62828',
      bg: '#FFEBEE'
    },
    {
      icon: 'local_shipping',
      label: 'Livraisons',
      value: data.livraisons,
      color: '#E65100',
      bg: '#FFF3E0'
    },
    {
      icon: 'payments',
      label: 'Revenus mensuels',
      value: data.revenusMensuel + ' DH',
      color: '#6A1B9A',
      bg: '#F3E5F5'
    },
    {
      icon: 'inventory',
      label: 'Stock total',
      value: data.stockTotal + ' kg',
      color: '#00695C',
      bg: '#E0F2F1'
    }
  ];

  // ✅ 🔥 ICI tu ajoutes ton graphique
  if (data.revenusParMois) {
    this.lineChartData.labels = data.revenusParMois.map((item: any) => item.mois);
    this.lineChartData.datasets[0].data = data.revenusParMois.map((item: any) => item.montant);

    // ⚠️ IMPORTANT : refresh du graphique
    this.lineChartData = { ...this.lineChartData };
  }
  console.log('=======================',data.revenusParMois);
}
 
}
