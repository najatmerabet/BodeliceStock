import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  menuItems = [
    { icon: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { icon: 'inventory', label: 'Produits', route: '/produits' },
    { icon: 'warehouse', label: 'Stock Usine', route: '/stock-usine' },
    { icon: 'add_circle', label: 'Production', route: '/production' },
    { icon: 'people', label: 'Clients', route: '/clients' },
    { icon: 'handshake', label: "Porteurs d'Affaires", route: '/porteurs-affaire' },
    { icon: 'local_shipping', label: 'Bons de Livraison', route: '/bons-livraison' },
    { icon: 'description', label: 'Proformas', route: '/proformas' },
    { icon: 'receipt_long', label: 'Factures', route: '/factures' },
    { icon: 'assignment_return', label: 'Avoirs', route: '/avoirs' },
    { icon: 'history', label: 'Logs', route: '/logs' },
  ];
}
