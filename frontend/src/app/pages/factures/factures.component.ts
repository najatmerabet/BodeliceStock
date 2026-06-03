import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FactureService, Facture } from '../../services/facture.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-factures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './factures.component.html',
  styleUrl: './factures.component.scss'
})
export class FacturesComponent implements OnInit {
  factures: Facture[] = [];
  filteredFactures: Facture[] = [];
  loading = false;
  searchQuery = '';
  filterClient = '';
  filterStatut = '';
  filterDateFrom = '';
  filterDateTo = '';
  message = '';
  messageType: 'success' | 'error' = 'success';

  view: 'list' | 'detail' = 'list';
  selectedFacture: Facture | null = null;

  // Payment Modal
  showPaymentModal = false;
  paymentMontant = 0;
  paymentMethod = 'ESPECE';
  paymentRemarque = '';
  paymentLoading = false;

  // PDF
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';

  constructor(
    private factureService: FactureService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadFactures();
  }

  loadFactures(): void {
    this.loading = true;
    this.factureService.getAll().subscribe({
      next: (data) => {
        this.factures = data.map((f: any) => ({
          ...f,
          total: Number(f.total),
          paye: Number(f.paye),
          reste: Number(f.reste),
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.showMessage('Erreur de chargement', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredFactures = this.factures.filter(f => {
      const matchSearch = f.numero.toLowerCase().includes(q) ||
        (f.client?.nom || '').toLowerCase().includes(q);
      const matchClient = !this.filterClient || f.clientId === Number(this.filterClient);
      const matchStatut = !this.filterStatut || f.statut === this.filterStatut;
      const fDate = new Date(f.date);
      const matchDateFrom = !this.filterDateFrom || fDate >= new Date(this.filterDateFrom);
      const matchDateTo = !this.filterDateTo || fDate <= new Date(this.filterDateTo);
      return matchSearch && matchClient && matchStatut && matchDateFrom && matchDateTo;
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterClient = '';
    this.filterStatut = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.applyFilter();
  }

  openDetail(f: Facture): void {
    this.loading = true;
    this.factureService.getById(f.id).subscribe({
      next: (full: any) => {
        this.selectedFacture = {
          ...full,
          total: Number(full.total),
          paye: Number(full.paye),
          reste: Number(full.reste),
          totalHT: Number(full.totalHT),
          totalTVA: Number(full.totalTVA),
          totalRemise: Number(full.totalRemise),
          avoirs: (full['avoirs'] || []).map((a: any) => ({
            ...a,
            total: Number(a.total)
          })),
          lignes: full.proforma ? full.proforma.lignes.map((l: any) => ({
            ...l,
            quantite: Number(l.quantite) || 0,
            prix: Number(l.prix) || 0,
            remise: Number(l.remise) || 0,
            tva: Number(l.tva) || 0,
            totalTTC: Number(l.totalTTC) || 0,
            nbUnites: l.nbUnites ? Number(l.nbUnites) : null,
            poidsUnitaire: l.poidsUnitaire ? Number(l.poidsUnitaire) : null
          })) : (full.bonsLivraison || []).reduce((acc: any[], bl: any) => {
            return acc.concat((bl.lignes || []).map((l: any) => {
              const qte = Number(l.quantite) || 0;
              const prix = Number(l.prix) || 0;
              const tva = Number(l.produit?.tva || 0);
              return {
                produit: l.produit,
                quantite: qte,
                prix: prix,
                remise: 0,
                tva: tva,
                totalTTC: (qte * prix) * (1 + tva / 100),
                nbUnites: l.nbUnites ? Number(l.nbUnites) : null,
                poidsUnitaire: l.poidsUnitaire ? Number(l.poidsUnitaire) : null
              };
            }));
          }, [])
        };
        this.view = 'detail';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  backToList(): void {
    this.view = 'list';
    this.selectedFacture = null;
    this.cdr.detectChanges();
  }

  openPayment(f: Facture): void {
    this.selectedFacture = f;
    this.paymentMontant = Number(f.reste);
    this.showPaymentModal = true;
    this.cdr.detectChanges();
  }

  closePayment(): void {
    this.showPaymentModal = false;
    this.paymentMontant = 0;
    this.paymentMethod = 'ESPECE';
    this.paymentRemarque = '';
    this.cdr.detectChanges();
  }

  confirmPayment(): void {
    if (!this.selectedFacture || this.paymentMontant <= 0) return;

    this.paymentLoading = true;
    this.factureService.payer(this.selectedFacture.id, this.paymentMontant, this.paymentMethod, this.paymentRemarque || undefined).subscribe({
      next: (updated) => {
        this.showMessage(`✅ Paiement de ${this.paymentMontant} DH enregistré`, 'success');
        this.loadFactures();
        this.closePayment();
        this.paymentLoading = false;
        if (this.view === 'detail') this.openDetail(updated);
        this.cdr.detectChanges();
      },
      error: () => {
        this.paymentLoading = false;
        this.showMessage('❌ Erreur lors du paiement', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  getMethodeLabel(methode: string): string {
    const labels: Record<string, string> = {
      'ESPECE': 'Espèce',
      'CHEQUE': 'Chèque',
      'VIREMENT': 'Virement'
    };
    return labels[methode] || methode;
  }

  deleteFacture(f: Facture): void {
    if (!confirm('Supprimer cette facture ? Les BLs associés redeviendront "A FACTURER".')) return;

    this.factureService.delete(f.id).subscribe({
      next: () => {
        this.showMessage('✅ Facture supprimée', 'success');
        this.loadFactures();
        if (this.view === 'detail') this.backToList();
        this.cdr.detectChanges();
      }
    });
  }

  // PDF
async generatePDF(f: Facture): Promise<void> {
  this.factureService.getById(f.id).subscribe({
    next: async (full: any) => {
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

      // 1. LOGO
      const LOGO_X = 10;
      const LOGO_Y = -20;
      const LOGO_W = 90;
      const LOGO_H = 90;

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
      const INFO_X = ML;
      const INFO_Y = LOGO_Y + LOGO_H -10 ;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text('PRODMEAT', INFO_X, INFO_Y);

      const prodmeatLines = [
        'Bd mly Ismail res mly Ismail N°22 etg 5',
        'N 19 - TANGER',
        'TÉL : 06 66 57 03 03',
        'MAIL : secretariatprodmeat@gmail.com',
        'N° ONSSA: MAPAV.34.21.24',
      ];
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.setFontSize(11);
      prodmeatLines.forEach((line, i) => doc.text(line, INFO_X, INFO_Y + 5 + i * 6));

      // 3. BLOC CLIENT
      const client = full.client || {};
      const CX = 110;
      const CY = INFO_Y-20 ; // ← aligné avec PRODMEAT
      const CW = W - CX - MR;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      let addressLines: string[] = [];
      if (client.adresse) {
        addressLines = doc.splitTextToSize(client.adresse.toUpperCase(), CW - 6);
      }

      let textHeight = 12;
      textHeight += 7;
      if (addressLines.length > 0) {
        textHeight += (addressLines.length - 1) * 4.5;
      }
      textHeight += 7;
      if (client.ice) textHeight += 4;
      if (client.reference) textHeight += 4;
      const CH = Math.max(44, textHeight + 4);

      doc.setFillColor(...WHITE);
      doc.setDrawColor(...NOIR);
      doc.setLineWidth(0.3);
      doc.roundedRect(CX, CY, CW, CH, 2, 2, 'FD');

      let currentY = CY + 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text((client.nom || '—').toUpperCase(), CX + 3, currentY);

      currentY += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NOIR);
      if (addressLines.length > 0) {
        addressLines.forEach((line: string) => {
          doc.text(line, CX + 3, currentY);
          currentY += 7;
        });
      }

      const cpVille = [client.codepostal, client.ville].filter(Boolean).join('     ').toUpperCase();
      if (cpVille) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(cpVille, CX + 3, currentY);
        currentY += 7;
      } else {
        currentY += 7;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...NOIR);
      if (client.ice) {
        doc.text(`ICE: ${client.ice}`.toUpperCase(), CX + 3, currentY);
        currentY += 5;
      }

      // if (client.reference) {
      //   doc.text(`N° Client: ${client.reference}`.toUpperCase(), CX + 3, currentY);
      // }

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRIS_L);
      doc.text('1/1', W - MR, CY + 5, { align: 'right' });
      
      if(client.reference) {
        doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NOIR);
  doc.text(`N° CLIENT: ${client.reference}`.toUpperCase(), CX + 3, CY + CH + 5);
      }
      // 4. BANDEAU "FACTURE N°" + date à droite
      const BY = CY + CH + 8;
      const BH = 9;

      const dateObj = full.date ? new Date(full.date) : new Date();
      const dateStr = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).toUpperCase();

      const PAD = 4;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      const labelW = doc.getTextWidth('FACTURE N°');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const numeroW = doc.getTextWidth(full.numero || 'F-XXXX');

      const LEFT_W = PAD + labelW + 4 + numeroW + PAD;

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(ML, BY, LEFT_W, BH);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text('FACTURE N°', ML + PAD, BY + BH - 2.5);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text(full.numero || 'F-XXXX', ML + PAD + labelW + 4, BY + BH - 2.5);

      // Date alignée à droite de la page
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text(dateStr, W - MR, BY + BH - 2.5, { align: 'right' });

      // 5. TABLEAU PRODUITS
      let lignes: any[] = [];
      if (full.proforma) {
        lignes = full.proforma.lignes.map((l: any) => ({ ...l }));
      } else if (full.bonsLivraison) {
        lignes = (full.bonsLivraison || []).reduce(
          (acc: any[], bl: any) => acc.concat((bl.lignes || []).map((l: any) => ({ ...l }))), []
        );
      }

      const MIN_ROWS = 10;
      const bodyRows: any[] = [];
      lignes.forEach((l: any) => {
        const prix = Number(l.prix ?? 0);
        const qte = Number(l.nbUnites ?? 1);
        const total = Number(l.total ?? qte * prix);
        const tva = Number(l.tva ?? l.produit?.tva ?? 0);
        const unite = l.produit?.unite || 'boule';
        bodyRows.push([
          (l.produit?.reference || '').toUpperCase(),
          (l.produit?.nom || '').toUpperCase(),
          `${tva}%`,
          l.nbUnites ? `${Number(l.nbUnites)}` : '-',
          unite,
          `${prix.toFixed(2)}`,
          `${total.toFixed(2)}`,
        ]);
      });

      while (bodyRows.length < MIN_ROWS) {
        bodyRows.push(['', '', '', '', '', '', '']);
      }

      autoTable(doc, {
        startY: BY + BH + 3,
        head: [['RÉF', 'DÉSIGNATION', 'TVA', 'QTE', 'UNITÉ', 'PRIX U HT', 'TOTAL HT']],
        body: bodyRows,
        theme: 'plain',
        styles: {
          textColor: NOIR, lineColor: NOIR, lineWidth: 0, minCellHeight: 10, fillColor: WHITE,
        },
        headStyles: {
          fillColor: WHITE, textColor: NOIR, fontStyle: 'bold', fontSize: 7.5,
          lineColor: NOIR, lineWidth: 0.3,
        },
        alternateRowStyles: { fillColor: WHITE },
        columnStyles: {
          0: { cellWidth: 24, halign: 'left' as const },
          1: { cellWidth: 52, halign: 'left' as const },
          2: { cellWidth: 15, halign: 'center' as const },
          3: { cellWidth: 18, halign: 'center' as const },
          4: { cellWidth: 22, halign: 'center' as const },
          5: { cellWidth: 32, halign: 'right' as const },
          6: { cellWidth: 32, halign: 'right' as const },
        },
        tableWidth: 'auto',
        didDrawCell: (data) => {
          const { doc: d, cell, column, table } = data;
          const lastCol = table.columns.length - 1;
          d.setDrawColor(15, 23, 42);
          d.setLineWidth(0.3);
          // Bordures verticales
          d.line(cell.x, cell.y, cell.x, cell.y + cell.height);
          if (column.index === lastCol) {
            d.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
          }
          // Ligne de séparation sous le header
          if (data.row.section === 'head') {
            d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
          }
        },
      });

      // Fermer le tableau en bas
      const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? 200;
      const tableStartX = ML;
      const tableEndX = ML + 24 + 52 + 15 + 18 + 22 + 32 + 32;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(tableStartX, tableEndY, tableEndX, tableEndY);

      // 6. BLOC TOTAUX (contenu facture : HT, TVA, TTC, payé, reste)
      const totalHT = Number(full.totalHT ?? 0);
      const totalTVA = Number(full.totalTVA ?? 0);
      const totalTTC = Number(full.total ?? 0);
      const paye = Number(full.paye ?? 0);
      const reste = totalTTC - paye;

      const totRows = [
        { label: 'TOTAL HT', value: `${totalHT.toFixed(2)} DH`, bold: true },
        { label: 'TVA', value: `${totalTVA.toFixed(2)} DH`, bold: false },
        { label: 'TOTAL TTC', value: `${totalTTC.toFixed(2)} DH`, bold: true },
        { label: 'MONTANT PAYÉ', value: `${paye.toFixed(2)} DH`, bold: false },
        { label: 'RESTE À PAYER', value: `${reste.toFixed(2)} DH`, bold: true, red: reste > 0 },
      ];

      const ROW_H = 7.5;
      const BOX_W = 87;
      const BOX_X = W - MR - BOX_W;
      const BOX_Y = tableEndY + 4;

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(BOX_X, BOX_Y, BOX_W, totRows.length * ROW_H);

      totRows.forEach(({ label, value, bold, red }, i) => {
        const rowY = BOX_Y + i * ROW_H;
        if (i > 0) {
          doc.setDrawColor(...BORDER);
          doc.line(BOX_X, rowY, BOX_X + BOX_W, rowY);
        }
        if (label === 'TOTAL TTC' || label === 'RESTE À PAYER') {
          doc.setFillColor(...LIGHT);
          doc.rect(BOX_X, rowY, BOX_W, ROW_H, 'F');
        }
        const textY = rowY + ROW_H - 2.2;
        doc.setFontSize(8);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        const textColor: [number, number, number] = red ? [180, 30, 30] : NOIR;
        doc.setTextColor(...textColor);
        doc.text(label, BOX_X + 3, textY);
        doc.text(value, BOX_X + BOX_W - 3, textY, { align: 'right' });
      });

      // 7. HISTORIQUE DES PAIEMENTS
      const paiements: any[] = full.paiements || [];
      if (paiements.length > 0) {
        const payTableY = tableEndY + 3;

        // doc.setFontSize(8);
        // doc.setFont('helvetica', 'bold');
        // doc.setTextColor(...NOIR);
        // doc.text('HISTORIQUE DES PAIEMENTS', ML, payTableY);

        const histBodyRows = paiements.map((p: any) => {
          const pDate = p.date ? new Date(p.date) : new Date();
          const methodeLabel = this.getMethodeLabel(p.methode || 'ESPECE');
          return [
            ('0' + pDate.getDate()).slice(-2) + '/' + ('0' + (pDate.getMonth() + 1)).slice(-2) + '/' + pDate.getFullYear(),
            (p.libelle || methodeLabel).toUpperCase(),
            Number(p.montant || 0).toFixed(2) + ' DH',
          ];
        });
        const totalPaye = Number(full.paye ?? 0);

      autoTable(doc, {
  startY: payTableY + 5,
  margin: { left: ML },
  head: [['Date', 'Libellé', 'Montant']],
  body: histBodyRows,
  foot: [['', 'TOTAL PAYÉ', `${totalPaye.toFixed(2)} DH`]],
  theme: 'plain',
  styles: {
    textColor: NOIR, lineColor: NOIR, lineWidth: 0, fontSize: 7, minCellHeight: 7,
    cellPadding: { top: 1, right: 3, bottom: 1, left: 3 },
  },
  headStyles: {
    fillColor: WHITE, textColor: NOIR, fontStyle: 'bold', fontSize: 7,
    cellPadding: { top: 1, right: 3, bottom: 1, left: 3 },
  },
  footStyles: {
    fillColor: LIGHT, textColor: NOIR, fontStyle: 'bold', fontSize: 7,
    lineColor: NOIR, lineWidth: 0,
    cellPadding: { top: 1, right: 3, bottom: 1, left: 3 },
  },
  columnStyles: {
    0: { cellWidth: 20, halign: 'left' as const },
    1: { cellWidth: 35, halign: 'left' as const },
    2: { cellWidth: 25, halign: 'left' as const , cellPadding: {top: 2, bottom:2, left:2, right:3}},
  },
  didDrawCell: (data) => {
    const { doc: d, cell, column, table } = data;
    const lastCol = table.columns.length - 1;

    d.setDrawColor(15, 23, 42);
    d.setLineWidth(0.3);

    if (column.index === 0) {
      d.line(cell.x, cell.y, cell.x, cell.y + cell.height);
    }
    if (column.index === lastCol) {
      d.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
    }
    if (data.row.section === 'head' && data.row.index === 0) {
      d.line(cell.x, cell.y, cell.x + cell.width, cell.y);
    }
    if (data.row.section === 'foot') {
      d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
    }
  },
});

        // Fermer le tableau historique en bas
        const histEndY: number = (doc as any).lastAutoTable?.finalY ?? 200;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.3);
        doc.line(ML, histEndY, ML + 20 + 35 + 25, histEndY);
      }

      // 8. FOOTER
      const FY = H - 13;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(ML, FY, W - MR, FY);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text('PRODMEAT - Bd mly Ismail res mly Ismail N°22 etg 5 - N 19 - TANGER', W / 2, FY + 4, { align: 'center' });
      doc.text('ICE : 003291478000039   R.C: 1328011   CNSS 4810442   Patente: 57225884   IF: 53783148', W / 2, FY + 8, { align: 'center' });
      doc.text('Attijariwafa Bank   007 640 00 14335000003128 43', W / 2, FY + 12, { align: 'center' });

      // Preview
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      this.pdfPreviewBlobUrl = url;
      this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.pdfPreviewName = `${full.numero}.pdf`;
      this.cdr.detectChanges();
    }
  });
}
  closePdfPreview(): void {
    if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
    this.pdfPreviewUrl = null; this.pdfPreviewBlobUrl = null;
    this.cdr.detectChanges();
  }

  downloadPdf(): void {
    if (!this.pdfPreviewBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.pdfPreviewBlobUrl; a.download = this.pdfPreviewName; a.click();
  }

  createAvoir(f: Facture): void {
    this.router.navigate(['/avoirs'], { queryParams: { factureId: f.id } });
  }

  // ── HELPERS ──
  getCount(statut: string): number {
    return this.factures.filter(f => f.statut === statut).length;
  }

  getPaymentPercent(): number {
    if (!this.selectedFacture || !this.selectedFacture.total) return 0;
    return (Number(this.selectedFacture.paye) / Number(this.selectedFacture.total)) * 100;
  }

  getUniqueClients(): any[] {
    const clients = new Map<number, any>();
    this.factures.forEach(f => {
      if (f.client && !clients.has(f.client.id)) {
        clients.set(f.client.id, f.client);
      }
    });
    return Array.from(clients.values());
  }

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4500);
  }
}
