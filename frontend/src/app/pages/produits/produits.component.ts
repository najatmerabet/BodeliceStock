import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProduitService } from '../../services/produit.service';
import { Produit } from '../../models/produit.model';

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './produits.component.html',
  styleUrl: './produits.component.scss'
})
export class ProduitsComponent implements OnInit {
  produits: Produit[] = [];
  loading = false;
  message = '';

  constructor(private produitService: ProduitService) {}

  ngOnInit(): void {
    this.loadProduits();
  }

  loadProduits(): void {
    this.loading = true;
    this.produitService.getProduits().subscribe({
      next: (data) => {
        console.log('Produits reçus:', data);
        this.produits = data.map(p => ({
          ...p,
          prix: Number(p.prix),
          stock: Number(p.stock)
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.loading = true;
      this.produitService.importExcel(file).subscribe({
        next: (res) => {
          this.message = res.message;
          this.loadProduits();
          this.loading = false;
          // Reset input
          event.target.value = '';
          setTimeout(() => this.message = '', 3000);
        },
        error: (err) => {
          console.error(err);
          this.message = "Erreur lors de l'import";
          this.loading = false;
          setTimeout(() => this.message = '', 3000);
        }
      });
    }
  }

  triggerFileInput(): void {
    document.getElementById('excelUpload')?.click();
  }
}
