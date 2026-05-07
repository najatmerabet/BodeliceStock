import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProduitService } from '../../services/produit.service';
import { Produit } from '../../models/produit.model';

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './produits.component.html',
  styleUrl: './produits.component.scss'
})
export class ProduitsComponent implements OnInit {
  produits: Produit[] = [];
  filteredProduits: Produit[] = [];
  pagedProduits: Produit[] = [];
  searchQuery = '';
  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // Delete confirmation
  deleteTarget: Produit | null = null;
  deleting = false;

  constructor(
    private produitService: ProduitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProduits();
  }

  loadProduits(): void {
    this.loading = true;
    this.produitService.getProduits().subscribe({
      next: (data) => {
        this.produits = data.map(p => ({
          ...p,
          prix: Number(p.prix),
          stock: Number(p.stock)
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.showMessage('Erreur de connexion au serveur', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredProduits = !q
      ? [...this.produits]
      : this.produits.filter(p => p.nom.toLowerCase().includes(q));
    this.currentPage = 1;
    this.updatePage();
  }

  updatePage(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredProduits.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedProduits = this.filteredProduits.slice(start, start + this.pageSize);
    this.cdr.detectChanges();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePage();
    }
  }

  get pages(): number[] {
    const p: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) p.push(i);
    return p;
  }

  // Delete
  confirmDelete(p: Produit): void {
    this.deleteTarget = p;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    this.deleting = true;
    this.produitService.deleteProduit(this.deleteTarget.id).subscribe({
      next: () => {
        this.showMessage(`"${this.deleteTarget!.nom}" supprimé`, 'success');
        this.deleteTarget = null;
        this.deleting = false;
        this.loadProduits();
      },
      error: () => {
        this.showMessage('Erreur lors de la suppression', 'error');
        this.deleting = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Excel Import
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.loading = true;
      this.produitService.importExcel(file).subscribe({
        next: (res) => {
          this.showMessage(`✅ ${res.message}`, 'success');
          this.loadProduits();
          event.target.value = '';
        },
        error: () => {
          this.showMessage("Erreur lors de l'import", 'error');
          this.loading = false;
          event.target.value = '';
          this.cdr.detectChanges();
        }
      });
    }
  }

  triggerFileInput(): void {
    document.getElementById('excelUpload')?.click();
  }

  getStockStatus(stock: number): string {
    if (stock <= 0) return 'rupture';
    if (stock < 20) return 'low';
    return 'ok';
  }

  getStockPercent(stock: number): number {
    return Math.min(100, (stock / 500) * 100);
  }

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    this.cdr.detectChanges();
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4000);
  }
}
