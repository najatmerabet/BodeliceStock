import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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

  // Transfert Marrakech
  showTransferModal = false;
  transferLignes: any[] = [];
  newTransferLigne = { produitId: 0, nbUnites: 1, poidsUnitaire: 0 };
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';

  constructor(
    private stockService: StockService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

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

  getUnite(produitId: number): string {
    const p = this.produits.find(p => p.id === produitId);
    return p ? p.unite : '';
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
      row2.push(`${p.nom} (${p.poidsUnitaire} KG / ${p.unite})`);
    });
    aoa.push(row2);

    // Ligne de Stock Tanger
    const rowTanger: any[] = ['STOCK TANGER'];
    this.produits.forEach(p => {
      rowTanger.push(p.stockTanger ? `${p.stockTanger} ${p.unite}` : `0 ${p.unite}`);
    });
    aoa.push(rowTanger);

    // Ligne de Stock Marrakech
    const rowMarrakech: any[] = ['STOCK MARRAKECH'];
    this.produits.forEach(p => {
      rowMarrakech.push(p.stockMarrakech ? `${p.stockMarrakech} ${p.unite}` : `0 ${p.unite}`);
    });
    aoa.push(rowMarrakech);

    // Ligne de Stock Total
    const rowTotal: any[] = ['STOCK TOTAL'];
    this.produits.forEach(p => {
      rowTotal.push(p.stockTotal ? `${p.stockTotal} ${p.unite}` : `0 ${p.unite}`);
    });
    aoa.push(rowTotal);

    // Données (Dates et quantités)
    this.dates.forEach(d => {
      const row: any[] = [d];
      this.produits.forEach(p => {
        const qte = this.getQuantite(d, p.id);
        row.push(qte ? `${qte} ${p.unite}` : '');
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
    ws['!cols'] = [{ wch: 20 }];
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
        head2.push(`${p.poidsUnitaire} KG / ${p.unite}`);
      });
    });

    const body: any[] = [];

    // Ajouter les lignes de Stock
    const tangerRow = ['STOCK TANGER'];
    this.produits.forEach(p => {
      tangerRow.push(p.stockTanger ? `${p.stockTanger} ${p.unite}` : `0 ${p.unite}`);
    });
    body.push(tangerRow);

    const marrakechRow = ['STOCK MARRAKECH'];
    this.produits.forEach(p => {
      marrakechRow.push(p.stockMarrakech ? `${p.stockMarrakech} ${p.unite}` : `0 ${p.unite}`);
    });
    body.push(marrakechRow);

    const totalRow = ['STOCK TOTAL'];
    this.produits.forEach(p => {
      totalRow.push(p.stockTotal ? `${p.stockTotal} ${p.unite}` : `0 ${p.unite}`);
    });
    body.push(totalRow);

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

  openTransferModal(): void {
    this.transferLignes = [];
    this.newTransferLigne = { produitId: 0, nbUnites: 1, poidsUnitaire: 0 };
    this.showTransferModal = true;
    this.cdr.detectChanges();
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.cdr.detectChanges();
  }

  onTransferProduitChange(): void {
    const p = this.produits.find(prod => prod.id === Number(this.newTransferLigne.produitId));
    if (p) {
      this.newTransferLigne.poidsUnitaire = Number(p.poidsUnitaire || 1);
    }
  }

  addTransferLigne(): void {
    const pid = Number(this.newTransferLigne.produitId);
    if (!pid || this.newTransferLigne.nbUnites <= 0) return;
    const p = this.produits.find(prod => prod.id === pid);
    if (!p) return;

    this.transferLignes.push({
      produitId: pid,
      produitNom: p.nom,
      produitRef: p.reference,
      produitUnite: p.unite,
      nbUnites: this.newTransferLigne.nbUnites,
      poidsUnitaire: this.newTransferLigne.poidsUnitaire,
      quantite: this.newTransferLigne.nbUnites * this.newTransferLigne.poidsUnitaire
    });

    this.newTransferLigne = { produitId: 0, nbUnites: 1, poidsUnitaire: 0 };
    this.cdr.detectChanges();
  }

  removeTransferLigne(index: number): void {
    this.transferLignes.splice(index, 1);
    this.cdr.detectChanges();
  }

  executeTransfer(): void {
    if (this.transferLignes.length === 0 || this.saving) return;
    this.saving = true;

    const payload = this.transferLignes.map(l => ({
      produitId: l.produitId,
      nbUnites: l.nbUnites,
      poidsUnitaire: l.poidsUnitaire
    }));

    this.stockService.createTransfert(payload).subscribe({
      next: (bl) => {
        this.saving = false;
        this.showTransferModal = false;
        this.loadData();
        this.cdr.detectChanges();
        this.generateTransferPDF(bl);
      },
      error: (err) => {
        console.error('Erreur lors du transfert:', err);
        this.saving = false;
        alert(err.error?.error || 'Erreur lors de l\'exécution du transfert');
        this.cdr.detectChanges();
      }
    });
  }

  async generateTransferPDF(bl: any): Promise<void> {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, H = 297, ML = 14, MR = 14;

      const NOIR: [number, number, number] = [15, 23, 42];
      const GRIS: [number, number, number] = [100, 116, 139];
      const GRIS_L: [number, number, number] = [148, 163, 184];
      const WHITE: [number, number, number] = [255, 255, 255];
      const LIGHT: [number, number, number] = [248, 250, 252];
      const BORDER: [number, number, number] = [226, 232, 240];

      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, 'F');

      const client = bl.client || {};
      const lignes = bl.lignes || [];

      // 1. LOGO BÔDÉLICE
      const LOGO_X = ML;
      const LOGO_Y = 8;
      const LOGO_W = 40;
      const LOGO_H = 40;

      try {
        const logoImg = new Image();
        logoImg.src = 'assets/logo.png';
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          setTimeout(resolve, 500);
        });
        if (logoImg.complete) {
          doc.addImage(logoImg, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
        }
      } catch (e) {
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.roundedRect(LOGO_X, LOGO_Y, LOGO_W, LOGO_H, 2, 2, 'D');
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NOIR);
        doc.text('BÔDÉLICE', LOGO_X + LOGO_W / 2, LOGO_Y + 11, { align: 'center' });
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...GRIS);
        doc.text('Goût, qualité, tradition', LOGO_X + LOGO_W / 2, LOGO_Y + 17, { align: 'center' });
      }

      // 2. INFOS PRODMEAT
      const INFO_Y = LOGO_Y + LOGO_H + 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text('PRODMEAT', ML, INFO_Y);

      const prodmeatLines = [
        'BD MLY ISMAIL RES MLY ISMAIL N°22 ETG 5',
        'N 19 - TANGER',
        'TÉL : 06 66 57 03 03',
        'MAIL : SECRETARIATPRODMEAT@GMAIL.COM',
        'N° ONSSA: MAPAV.34.21.24',
      ];
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.setFontSize(8);
      prodmeatLines.forEach((line, i) => doc.text(line, ML, INFO_Y + 4 + i * 4));

      // 3. BLOC CLIENT
      const CX = 105;
      const CY = LOGO_Y;
      const CW = W - CX - MR;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let addressLines = doc.splitTextToSize((client.adresse || '').toUpperCase(), CW - 6);
      
      let textHeight = 12; // name offset
      textHeight += 7; // address start offset
      if (addressLines.length > 0) {
        textHeight += (addressLines.length - 1) * 4.5;
      }
      textHeight += 7; // cpVille offset
      if (client.ice) textHeight += 4;
      if (client.reference) textHeight += 4;
      const CH = Math.max(44, textHeight + 4);

      doc.setFillColor(...LIGHT);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(CX, CY, CW, CH, 2, 2, 'FD');

      let currentY = CY + 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NOIR);
      doc.text((client.nom || '—').toUpperCase(), CX + 3, currentY);

      currentY += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NOIR);
      if (addressLines.length > 0) {
        addressLines.forEach((line: string) => {
          doc.text(line, CX + 3, currentY);
          currentY += 4.5;
        });
      }

      const cpVille = [client.codepostal, client.ville].filter(Boolean).join('     ').toUpperCase();
      if (cpVille) {
        doc.setFont('helvetica', 'normal');
        doc.text(cpVille, CX + 3, currentY);
        currentY += 6.5;
      } else {
        currentY += 2;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...NOIR);
      if (client.ice) {
        doc.text(`ICE: ${client.ice}`.toUpperCase(), CX + 3, currentY);
        currentY += 4;
      }
      if (client.reference) {
        doc.text(`RÉF: ${client.reference}`.toUpperCase(), CX + 3, currentY);
      }

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRIS_L);
      doc.text('1/1', W - MR, CY + 5, { align: 'right' });

      // 4. BANDEAU "BON DE LIVRAISON N°" + date
      const BY = CY + CH + 25;
      const BH = 9;

      const dateObj = bl.date ? new Date(bl.date) : new Date();
      const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
      const rightText = dateStr;

      const PAD = 4;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      const labelW = doc.getTextWidth('BON DE LIVRAISON N°');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const numeroW = doc.getTextWidth(bl.numero || 'BL-XXXX');

      const LEFT_W = PAD + labelW + 4 + numeroW + PAD;

      let RIGHT_W = 0;
      if (rightText) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        RIGHT_W = Math.max(60, PAD + doc.getTextWidth(rightText) + PAD);
      }

      const BW = LEFT_W + RIGHT_W;

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(ML, BY, BW, BH);

      if (rightText) {
        doc.line(ML + LEFT_W, BY, ML + LEFT_W, BY + BH);
      }

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text('BON DE LIVRAISON N°', ML + 6, BY + BH - 2.5);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text(bl.numero || 'BL-XXXX', ML + PAD + labelW + 4, BY + BH - 2.5);

      if (rightText) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NOIR);
        doc.text(rightText, ML + LEFT_W + PAD, BY + BH - 2.5);
      }

      // 5. TABLEAU PRODUITS
      const tableData = lignes.map((l: any) => {
        const tva = Number(l.tva ?? l.produit?.tva ?? 0);
        const unite = l.produit?.unite || 'boule';
        const poidsTotal = l.quantite ? `${Number(l.quantite).toFixed(2)} kg` : '-';
        return [
          (l.produit?.reference || '').toUpperCase(),
          (l.produit?.nom || '').toUpperCase(),
          `${tva}%`,
          l.nbUnites ? `${Number(l.nbUnites)}` : '-',
          unite,
          poidsTotal,
          `${Number(l.prix).toFixed(2)}`,
          `${Number(l.total).toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: BY + BH + 3,
        head: [['RÉF', 'DÉSIGNATION', 'TVA', 'QTE', 'UNITÉ', 'POIDS TOTAL', 'PRIX U HT', 'TOTAL HT']],
        body: tableData,
        theme: 'plain',
        styles: {
          textColor: NOIR, lineColor: BORDER, lineWidth: 0.2, minCellHeight: 10, fillColor: WHITE,
        },
        headStyles: {
          fillColor: WHITE, textColor: NOIR, fontStyle: 'bold', fontSize: 7.5, lineColor: BORDER, lineWidth: 0.3,
        },
        alternateRowStyles: { fillColor: WHITE },
        columnStyles: {
          0: { cellWidth: 20, halign: 'left' as const },
          1: { cellWidth: 45, halign: 'left' as const },
          2: { cellWidth: 12, halign: 'center' as const },
          3: { cellWidth: 14, halign: 'center' as const },
          4: { cellWidth: 16, halign: 'center' as const },
          5: { cellWidth: 20, halign: 'center' as const },
          6: { cellWidth: 26, halign: 'right' as const },
          7: { cellWidth: 26, halign: 'right' as const },
        },
        tableWidth: 'auto',
      });

      // 6. BLOC TOTAUX
      const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? 200;
      const totalBL = Number(bl.total ?? 0);

      const ROW_H = 8;
      const BOX_W = 70;
      const BOX_X = W - MR - BOX_W;
      const BOX_Y = tableEndY + 4;

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(BOX_X, BOX_Y, BOX_W, ROW_H);

      doc.setFillColor(...LIGHT);
      doc.rect(BOX_X, BOX_Y, BOX_W, ROW_H, 'F');

      const textY = BOX_Y + ROW_H - 2.5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text('TOTAL', BOX_X + 3, textY);
      doc.text(`${totalBL.toFixed(2)} DH`, BOX_X + BOX_W - 3, textY, { align: 'right' });

      // 7. FOOTER
      const FY = H - 16;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(ML, FY, W - MR, FY);

      doc.setFontSize(6.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRIS);
      doc.text('PRODMEAT - Bd mly Ismail res mly Ismail N°22 etg 5 - N 19 - TANGER', W / 2, FY + 4, { align: 'center' });
      doc.text('ICE : 003291478000039   R.C: 1328011   CNSS 4810442   Patente: 57225884   IF: 53783148', W / 2, FY + 8, { align: 'center' });
      doc.text('Attijariwafa Bank   007 640 00 14335000003128 43', W / 2, FY + 12, { align: 'center' });

      const pdfBlob = doc.output('blob');
      if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
      this.pdfPreviewBlobUrl = URL.createObjectURL(pdfBlob);
      this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfPreviewBlobUrl);
      this.pdfPreviewName = `${bl.numero || 'BL'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    } catch (err) {
      console.error('PDF error:', err);
    }
    this.cdr.detectChanges();
  }

  closePdfPreview(): void {
    if (this.pdfPreviewBlobUrl) {
      URL.revokeObjectURL(this.pdfPreviewBlobUrl);
      this.pdfPreviewBlobUrl = null;
    }
    this.pdfPreviewUrl = null;
    this.cdr.detectChanges();
  }

  downloadPdf(): void {
    if (!this.pdfPreviewBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.pdfPreviewBlobUrl;
    a.download = this.pdfPreviewName;
    a.click();
  }
}
