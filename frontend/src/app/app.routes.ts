import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'produits',
        loadComponent: () =>
          import('./pages/produits/produits.component').then(m => m.ProduitsComponent),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./pages/clients/clients.component').then(m => m.ClientsComponent),
      },
      {
        path: 'bons-livraison',
        loadComponent: () =>
          import('./pages/bons-livraison/bons-livraison.component').then(m => m.BonsLivraisonComponent),
      },
      {
        path: 'factures',
        loadComponent: () =>
          import('./pages/factures/factures.component').then(m => m.FacturesComponent),
      },
      {
        path: 'proformas',
        loadComponent: () =>
          import('./pages/proformas/proformas.component').then(m => m.ProformasComponent),
      },
      {
        path: 'avoirs',
        loadComponent: () =>
          import('./pages/avoirs/avoirs.component').then(m => m.AvoirsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
