import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  stats = [
    { icon: 'inventory_2', label: 'Produits', value: '20', color: '#2E7D32', bg: '#E8F5E9', trend: '+3' },
    { icon: 'groups', label: 'Clients', value: '5', color: '#1565C0', bg: '#E3F2FD', trend: '+1' },
    { icon: 'local_shipping', label: 'Livraisons', value: '0', color: '#E65100', bg: '#FFF3E0', trend: '—' },
    { icon: 'receipt_long', label: 'Factures', value: '0', color: '#C62828', bg: '#FFEBEE', trend: '—' },
  ];
}
