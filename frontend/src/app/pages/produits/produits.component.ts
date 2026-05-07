import { Component, OnInit } from '@angular/core';
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
  searchQuery = '';
  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(private produitService: ProduitService) {}

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
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.showMessage('Erreur de connexion au serveur', 'error');
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredProduits = [...this.produits];
    } else {
      this.filteredProduits = this.produits.filter(p =>
        p.nom.toLowerCase().includes(q)
      );
    }
  }

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

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => this.message = '', 4000);
  }
}
