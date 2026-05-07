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

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  showModal = false;
  editMode = false;
  form: Produit = { nom: '', unite: 'kg', poidsUnitaire: 1, quantite: 0, prixUnitaire: 0 };
  saving = false;

  deleteTarget: Produit | null = null;
  deleting = false;

  unites = ['kg', 'boule', 'pièce', 'litre', 'rouleau', 'sachet'];

  constructor(private produitService: ProduitService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadProduits(); }

  loadProduits(): void {
    this.loading = true;
    this.produitService.getProduits().subscribe({
      next: (data) => {
        this.produits = data.map(p => ({
          ...p,
          prixUnitaire: Number(p.prixUnitaire),
          poidsUnitaire: Number(p.poidsUnitaire),
          quantite: Number(p.quantite),
        }));
        
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.showMessage('Erreur de connexion', 'error'); }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredProduits = !q ? [...this.produits] : this.produits.filter(p =>
      p.nom.toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q)
    );
    this.currentPage = 1;
    this.updatePage();
  }

  updatePage(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredProduits.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const s = (this.currentPage - 1) * this.pageSize;
    this.pagedProduits = this.filteredProduits.slice(s, s + this.pageSize);
    this.cdr.detectChanges();
  }

  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.updatePage(); } }

  get pages(): number[] {
    const arr: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }

  // Computed
  totalKg(p: Produit): number { return p.quantite * p.poidsUnitaire; }
  valeurTotale(p: Produit): number { return p.quantite * p.poidsUnitaire * p.prixUnitaire; }

  getStockLevel(p: Produit): string {
    if (p.quantite <= 0) return 'critical';
    if (p.quantite < 20) return 'warning';
    return 'healthy';
  }

  // Add / Edit
  openAdd(): void {
    this.editMode = false;
    this.form = { nom: '', unite: 'kg', poidsUnitaire: 1, quantite: 0, prixUnitaire: 0 };
    this.showModal = true;
  }

  openEdit(p: Produit): void {
    this.editMode = true;
    this.form = { ...p };
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  saveProduct(): void {
    if (!this.form.nom || !this.form.prixUnitaire) return;
    this.saving = true;
    if (this.editMode && this.form.id) {
      this.produitService.updateProduit(this.form.id, this.form).subscribe({
        next: () => { this.showMessage(`"${this.form.nom}" mis à jour`, 'success'); this.closeModal(); this.saving = false; this.loadProduits(); },
        error: () => { this.saving = false; this.showMessage('Erreur modification', 'error'); }
      });
    } else {
      this.produitService.addProduit(this.form).subscribe({
        next: () => { this.showMessage(`"${this.form.nom}" ajouté`, 'success'); this.closeModal(); this.saving = false; this.loadProduits(); },
        error: () => { this.saving = false; this.showMessage("Erreur ajout", 'error'); }
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
      next: () => { this.showMessage(`"${this.deleteTarget!.nom}" supprimé`, 'success'); this.deleteTarget = null; this.deleting = false; this.loadProduits(); },
      error: () => { this.deleting = false; this.showMessage('Erreur suppression', 'error'); }
    });
  }

  // Excel
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.loading = true;
    this.produitService.importExcel(file).subscribe({
      next: (res) => { this.showMessage(`✅ ${res.message}`, 'success'); this.loadProduits(); event.target.value = ''; },
      error: () => { this.showMessage("Erreur import", 'error'); this.loading = false; event.target.value = ''; }
    });
  }
  triggerFileInput(): void { document.getElementById('excelUpload')?.click(); }

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg; this.messageType = type; this.cdr.detectChanges();
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4000);
  }
}
