import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-stock-usine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-usine.component.html',
  styleUrl: './stock-usine.component.scss'
})
export class StockUsineComponent implements OnInit {
  data: any[] = [];
  groupedData: { categorie: string, items: any[] }[] = [];
  loading = false;
  
  dateDebut = '';
  dateFin = '';
  searchQuery = '';

  totalEntrees = 0;
  totalSorties = 0;
  stockTotal = 0;
  stockTangerTotal = 0;
  stockMarrakechTotal = 0;

  filteredData: any[] = [];

  constructor(private stockService: StockService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.stockService.getStockUsine(this.dateDebut, this.dateFin).subscribe({
      next: (res) => {
        this.data = res;
        this.applySearch();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement stock usine', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredData = q ? this.data.filter(item => item.nom.toLowerCase().includes(q)) : this.data;
    this.groupData();
    this.totalEntrees = this.filteredData.reduce((acc, curr) => acc + Number(curr.entrees || 0), 0);
    this.totalSorties = this.filteredData.reduce((acc, curr) => acc + Number(curr.sorties || 0), 0);
    this.stockTotal = this.filteredData.reduce((acc, curr) => acc + Number(curr.stockFinal || 0), 0);
    this.stockTangerTotal = this.filteredData.reduce((acc, curr) => acc + Number(curr.stockTanger || 0), 0);
    this.stockMarrakechTotal = this.filteredData.reduce((acc, curr) => acc + Number(curr.stockMarrakech || 0), 0);
  }

  groupData(): void {
    const groups = new Map<string, any[]>();
    
    this.filteredData.forEach(item => {
      const cat = item.categorie || 'AUTRES';
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat)!.push(item);
    });

    this.groupedData = Array.from(groups.keys()).map(k => ({
      categorie: k,
      items: groups.get(k)!
    }));
  }

  applyFilter(): void {
    this.loadData();
  }

  clearFilter(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.loadData();
  }

  exportExcel(): void {
    const rows = this.data.map(item => ({
      'DÉSIGNATION PRODUIT': item.nom,
      'POIDS (KG/Unité)': `${item.poidsUnitaire} KG / ${item.unite.toUpperCase()}`,
      'ENTRÉES (NB)': item.entrees,
      'SORTIES (NB)': item.sorties,
      'STOCK TANGER (NB)': item.stockTanger,
      'STOCK MARRAKECH (NB)': item.stockMarrakech,
      'STOCK TOTAL (NB)': item.stockFinal
    }));

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'StockUsine');
    xlsx.writeFile(wb, `Stock_Usine_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  exportPdf(): void {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`STOCK USINE LE ${new Date().toLocaleDateString('fr-FR')}`, 105, 15, { align: 'center' });
    
    if (this.dateDebut || this.dateFin) {
      doc.setFontSize(10);
      const periode = `Période: ${this.dateDebut || 'Début'} au ${this.dateFin || "Aujourd'hui"}`;
      doc.text(periode, 105, 22, { align: 'center' });
    }

    const body: any[] = [];
    
    this.groupedData.forEach(group => {
      // Ligne d'en-tête de catégorie
      body.push([
        { content: group.categorie.toUpperCase(), colSpan: 7, styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } }
      ]);
      
      group.items.forEach(item => {
        body.push([
          item.nom,
          `${item.poidsUnitaire} KG / ${item.unite.toUpperCase()}`,
          item.entrees,
          item.sorties,
          item.stockTanger,
          item.stockMarrakech,
          item.stockFinal
        ]);
      });
    });

    autoTable(doc, {
      startY: 30,
      head: [['DÉSIGNATION PRODUIT', 'POIDS (KG/Unité)', 'ENTRÉES', 'SORTIES', 'ST. TANGER', 'ST. KECH', 'ST. TOTAL']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [150, 150, 150], textColor: 0, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 35 },
        2: { halign: 'center', fillColor: [230, 245, 230], cellWidth: 20 },
        3: { halign: 'center', fillColor: [245, 230, 245], cellWidth: 20 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }
      }
    });

    doc.save(`Stock_Usine_${new Date().toISOString().slice(0,10)}.pdf`);
  }
}
