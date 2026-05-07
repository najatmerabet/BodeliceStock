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

  // Modal
  showModal = false;
  editMode = false;
  form: Produit = { nom: '', prix: 0, stock: 0 };
  saving = false;

  // Delete
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
        this.produits = data.map(p => ({ ...p, prix: Number(p.prix), stock: Number(p.stock) }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.showMessage('Erreur de connexion au serveur', 'error');
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredProduits = !q ? [...this.produits] : this.produits.filter(p => p.nom.toLowerCase().includes(q));
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
    if (page >= 1 && page <= this.totalPages) { this.currentPage = page; this.updatePage(); }
  }

  get pages(): number[] {
    const p: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) p.push(i);
    return p;
  }

  // Add / Edit
  openAdd(): void {
    this.editMode = false;
    this.form = { nom: '', prix: 0, stock: 0 };
    this.showModal = true;
  }

  openEdit(p: Produit): void {
    this.editMode = true;
    this.form = { ...p };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.form = { nom: '', prix: 0, stock: 0 };
  }

  saveProduct(): void {
    if (!this.form.nom || this.form.prix === undefined) return;
    this.saving = true;

    if (this.editMode && this.form.id) {
      this.produitService.updateProduit(this.form.id, this.form).subscribe({
        next: () => {
          this.showMessage(`"${this.form.nom}" mis à jour`, 'success');
          this.closeModal();
          this.saving = false;
          this.loadProduits();
        },
        error: () => { this.saving = false; this.showMessage('Erreur lors de la modification', 'error'); }
      });
    } else {
      this.produitService.addProduit(this.form).subscribe({
        next: () => {
          this.showMessage(`"${this.form.nom}" ajouté`, 'success');
          this.closeModal();
          this.saving = false;
          this.loadProduits();
        },
        error: () => { this.saving = false; this.showMessage("Erreur lors de l'ajout", 'error'); }
      });
    }
  }

  // Delete
  confirmDelete(p: Produit): void { this.deleteTarget = p; }
  cancelDelete(): void { this.deleteTarget = null; }
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
      error: () => { this.deleting = false; this.showMessage('Erreur de suppression', 'error'); }
    });
  }

  // Excel
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.loading = true;
    this.produitService.importExcel(file).subscribe({
      next: (res) => { this.showMessage(`✅ ${res.message}`, 'success'); this.loadProduits(); event.target.value = ''; },
      error: () => { this.showMessage("Erreur lors de l'import", 'error'); this.loading = false; event.target.value = ''; }
    });
  }
  triggerFileInput(): void { document.getElementById('excelUpload')?.click(); }

  getStockLevel(stock: number): string {
    if (stock <= 0) return 'critical';
    if (stock < 20) return 'warning';
    if (stock < 100) return 'moderate';
    return 'healthy';
  }

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg; this.messageType = type; this.cdr.detectChanges();
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4000);
  }
}
