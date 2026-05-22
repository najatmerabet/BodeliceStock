import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.component.html',
  styleUrl: './production.component.scss'
})
export class ProductionComponent implements OnInit {
  dates: string[] = [];
  produits: any[] = [];
  data: { [date: string]: { [produitId: number]: number } } = {};
  
  categories: { nom: string, produits: any[], colSpan: number }[] = [];

  loading = false;
  dateDebut = '';
  dateFin = '';
  searchQuery = '';

  // Modal d'ajout rapide
  showAddModal = false;
  saving = false;
  addForm = {
    produitId: 0,
    quantite: 0,
    date: new Date().toISOString().slice(0, 10)
  };

  constructor(private stockService: StockService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.stockService.getProduction(this.dateDebut, this.dateFin).subscribe({
      next: (res) => {
        this.dates = res.dates;
        this.produits = res.produits;
        this.data = res.data;
        this.groupProduits();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement production', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  rebuildCategories(produits: any[]): void {
    const catsMap = new Map<string, any[]>();
    produits.forEach(p => {
      const cat = p.categorie || 'SANS CATÉGORIE';
      if (!catsMap.has(cat)) catsMap.set(cat, []);
      catsMap.get(cat)!.push(p);
    });
    this.categories = Array.from(catsMap.keys()).map(k => ({
      nom: k,
      produits: catsMap.get(k)!,
      colSpan: catsMap.get(k)!.length
    }));
    this.produits = [];
    this.categories.forEach(cat => this.produits.push(...cat.produits));
  }

  groupProduits(): void {
    const catsMap = new Map<string, any[]>();
    this.produits.forEach(p => {
      const cat = p.categorie || 'SANS CATÉGORIE';
      if (!catsMap.has(cat)) catsMap.set(cat, []);
      catsMap.get(cat)!.push(p);
    });

    this.categories = Array.from(catsMap.keys()).map(k => ({
      nom: k,
      produits: catsMap.get(k)!,
      colSpan: catsMap.get(k)!.length
    }));

    // S'assurer que l'ordre des produits correspond à l'ordre des catégories pour le tableau
    this.produits = [];
    this.categories.forEach(cat => {
      this.produits.push(...cat.produits);
    });
  }

  applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    const filteredProduits = q ? this.produits.filter(p => p.nom.toLowerCase().includes(q)) : this.produits;
    this.rebuildCategories(filteredProduits);
    this.cdr.detectChanges();
  }

  applyFilter(): void {
    this.loadData();
  }

  clearFilter(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.loadData();
  }

  getQuantite(date: string, produitId: number): number | string {
    if (this.data[date] && this.data[date][produitId]) {
      return this.data[date][produitId];
    }
    return '';
  }

  openAddModal(produit?: any, date?: string): void {
    this.addForm = {
      produitId: produit ? produit.id : 0,
      quantite: 0,
      date: date || new Date().toISOString().slice(0, 10)
    };
    this.showAddModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
  }

  saveEntree(): void {
    if (!this.addForm.produitId || this.addForm.quantite <= 0) return;
    this.saving = true;
    this.stockService.addEntreeStock(this.addForm.produitId, this.addForm.quantite, this.addForm.date).subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.loadData(); // Rafraîchir le tableau
      },
      error: (err) => {
        console.error('Erreur ajout entree', err);
        this.saving = false;
      }
    });
  }

  exportExcel(): void {
    const aoa: any[][] = [];
    
    // Ligne 1 : Catégories
    const row1: any[] = ['DATE'];
    this.categories.forEach(cat => {
      row1.push(cat.nom.toUpperCase());
      // Cellules vides pour la fusion
      for (let i = 1; i < cat.produits.length; i++) {
        row1.push('');
      }
    });
    aoa.push(row1);

    // Ligne 2 : Produits (Nom + Poids)
    const row2: any[] = [''];
    this.produits.forEach(p => {
      row2.push(`${p.nom} (${p.poidsUnitaire} KG)`);
    });
    aoa.push(row2);

    // Données (Dates et quantités)
    this.dates.forEach(d => {
      const row: any[] = [d];
      this.produits.forEach(p => {
        const qte = this.getQuantite(d, p.id);
        row.push(qte ? `${qte} KG` : '');
      });
      aoa.push(row);
    });

    const ws = xlsx.utils.aoa_to_sheet(aoa);

    // Ajouter les fusions (merges) pour les catégories
    ws['!merges'] = [];
    let colIndex = 1;
    this.categories.forEach(cat => {
      if (cat.produits.length > 1) {
        ws['!merges']!.push({
          s: { r: 0, c: colIndex },
          e: { r: 0, c: colIndex + cat.produits.length - 1 }
        });
      }
      colIndex += cat.produits.length;
    });

    // Ajuster la largeur des colonnes
    ws['!cols'] = [{ wch: 15 }];
    this.produits.forEach(() => ws['!cols']!.push({ wch: 20 }));

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Production');
    xlsx.writeFile(wb, `Production_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  exportPdf(): void {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.setFontSize(16);
    doc.text(`LA PRODUCTION`, 140, 15, { align: 'center' });
    
    const head1: any[] = [{ content: 'DATE', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } }];
    const head2: any[] = [];

    this.categories.forEach(c => {
      head1.push({ content: c.nom.toUpperCase(), colSpan: c.colSpan, styles: { valign: 'middle', halign: 'center' } });
      c.produits.forEach(p => {
        head2.push(`${p.poidsUnitaire} KG`);
      });
    });

    const body: any[] = [];
    this.dates.forEach(d => {
      const row = [d];
      this.produits.forEach(p => {
        row.push(this.getQuantite(d, p.id) as string);
      });
      body.push(row);
    });

    autoTable(doc, {
      startY: 25,
      head: [head1, head2],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [173, 216, 230], textColor: 0, fontStyle: 'bold' }, // Bleu clair
    });

    doc.save(`Production_${new Date().toISOString().slice(0,10)}.pdf`);
  }
}
