import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { Authlayoutcomponent } from './authlayoutcomponent/authlayoutcomponent';
import { AuthGuard } from './pages/auth/auth.guard';
import { NoAuthGuard } from './pages/auth/no-auth.guard';

export const routes: Routes = [
  {
     path: 'auth',
     component: Authlayoutcomponent,
     canActivate: [NoAuthGuard],
     children:[
      {
         path:'login',  loadComponent: () => import('./pages/auth/auth.component').then(m => m.Auth)
      }
     ]
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
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
        path: 'stock-usine',
        loadComponent: () =>
          import('./pages/stock-usine/stock-usine.component').then(m => m.StockUsineComponent),
      },
      {
        path: 'production',
        loadComponent: () =>
          import('./pages/production/production.component').then(m => m.ProductionComponent),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./pages/clients/clients.component').then(m => m.ClientsComponent),
      },
      {
        path: 'clients/:id',
        loadComponent: () =>
          import('./pages/client-detail/client-detail-page.component').then(m => m.ClientDetailPageComponent),
      },
      {
        path: 'logs',
        loadComponent: () =>
          import('./pages/logs/logs.component').then(m => m.LogsComponent),

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
  { path: '**', redirectTo: 'auth/login' },
];
