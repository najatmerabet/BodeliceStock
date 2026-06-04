import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProformaService, FactureProforma, LigneProforma } from '../../services/proforma.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './proformas.component.html',
  styleUrl: './proformas.component.scss'
})
export class ProformasComponent implements OnInit {
  proformas: FactureProforma[] = [];
  filteredProformas: FactureProforma[] = [];
  loading = false;
  searchQuery = '';
  filterClient = '';
  filterStatut = '';
  filterDateFrom = '';
  filterDateTo = '';
  message = '';
  messageType: 'success' | 'error' = 'success';

  view: 'list' | 'detail' = 'list';
  selectedProforma: FactureProforma | null = null;
  editingLignes: any[] = []; // copy for editing remise/tva
  editMode = false;
  saving = false;

  // PDF preview
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';
  generatingPdf = false;

  constructor(
    private proformaService: ProformaService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void { this.loadProformas(); }

  loadProformas(): void {
    this.loading = true;
    this.proformaService.getAll().subscribe({
      next: (data) => {
        this.proformas = data.map((p: any) => ({
          ...p,
          totalHT: Number(p.totalHT),
          totalRemise: Number(p.totalRemise),
          totalTVA: Number(p.totalTVA),
          totalTTC: Number(p.totalTTC),
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.showMessage('Erreur de chargement', 'error'); this.cdr.detectChanges(); }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredProformas = this.proformas.filter(p => {
      const matchSearch = !q || p.numero.toLowerCase().includes(q) || (p.client?.nom || '').toLowerCase().includes(q);
      const matchClient = !this.filterClient || p.clientId === Number(this.filterClient);
      const matchStatut = !this.filterStatut || p.statut === this.filterStatut;
      const pDate = new Date(p.date);
      const matchDateFrom = !this.filterDateFrom || pDate >= new Date(this.filterDateFrom);
      const matchDateTo = !this.filterDateTo || pDate <= new Date(this.filterDateTo);
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

  getUniqueClients(): any[] {
    const clients = new Map<number, any>();
    this.proformas.forEach(p => {
      if (p.client && !clients.has(p.client.id)) {
        clients.set(p.client.id, p.client);
      }
    });
    return Array.from(clients.values());
  }

  openDetail(p: FactureProforma): void {
    this.loading = true;
    this.proformaService.getById(p.id).subscribe({
      next: (full: any) => {
        this.selectedProforma = {
          ...full,
          totalHT: Number(full.totalHT),
          totalRemise: Number(full.totalRemise),
          totalTVA: Number(full.totalTVA),
          totalTTC: Number(full.totalTTC),
        };
        this.editingLignes = (full.lignes || []).map((l: any) => ({
          ...l,
          quantite: Number(l.quantite),
          prix: Number(l.prix),
          remise: Number(l.remise),
          tva: Number(l.tva),
          totalAvantRemise: Number(l.totalAvantRemise),
          totalApresRemise: Number(l.totalApresRemise),
          totalTVA: Number(l.totalTVA),
          totalTTC: Number(l.totalTTC),
        }));
        this.editMode = false;
        this.view = 'detail';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  backToList(): void { this.view = 'list'; this.selectedProforma = null; this.editMode = false; this.cdr.detectChanges(); }

  toggleEdit(): void { this.editMode = !this.editMode; this.cdr.detectChanges(); }

  updateLigneCalc(l: any): void {
    const totalAvant = Number(l.quantite) * Number(l.prix);
    const apresRemise = totalAvant * (1 - l.remise / 100);
    const tvaAmount = apresRemise * (l.tva / 100);
    l.totalAvantRemise = totalAvant;
    l.totalApresRemise = apresRemise;
    l.totalTVA = tvaAmount;
    l.totalTTC = apresRemise + tvaAmount;
  }

  get editTotalHT(): number { return this.editingLignes.reduce((s, l) => s + (l.totalAvantRemise || 0), 0); }
  get editTotalRemise(): number { return this.editingLignes.reduce((s, l) => s + ((l.totalAvantRemise || 0) - (l.totalApresRemise || 0)), 0); }
  get editTotalTVA(): number { return this.editingLignes.reduce((s, l) => s + (l.totalTVA || 0), 0); }
  get editTotalTTC(): number { return this.editingLignes.reduce((s, l) => s + (l.totalTTC || 0), 0); }

  saveLignes(): void {
    if (!this.selectedProforma || this.saving) return;
    this.saving = true;
    const payload = this.editingLignes.map(l => ({ id: l.id, remise: l.remise, tva: l.tva }));
    this.proformaService.updateLignes(this.selectedProforma.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.editMode = false;
        this.showMessage('✅ Remises mises à jour', 'success');
        this.openDetail(updated);
      },
      error: (e) => { this.saving = false; this.showMessage('❌ ' + (e?.error?.error || 'Erreur'), 'error'); this.cdr.detectChanges(); }
    });
  }

  validerProforma(): void {
    if (!this.selectedProforma || this.saving) return;
    if (!confirm(`Valider ${this.selectedProforma.numero} et générer la facture définitive ?`)) return;
    this.saving = true;
    this.proformaService.valider(this.selectedProforma.id).subscribe({
      next: (facture) => {
        this.saving = false;
        this.showMessage(`✅ Facture ${facture.numero} générée avec succès`, 'success');
        this.loadProformas();
        this.backToList();
        this.cdr.detectChanges();
      },
      error: (e) => { this.saving = false; this.showMessage('❌ ' + (e?.error?.error || 'Erreur'), 'error'); this.cdr.detectChanges(); }
    });
  }

  deleteProforma(p: FactureProforma): void {
    if (!confirm(`Supprimer ${p.numero} ? Les BLs associés redeviendront "A FACTURER".`)) return;
    this.proformaService.delete(p.id).subscribe({
      next: () => { this.showMessage('✅ Proforma supprimée', 'success'); this.loadProformas(); if (this.view === 'detail') this.backToList(); this.cdr.detectChanges(); }
    });
  }

  getCount(statut: string): number { return this.proformas.filter(p => p.statut === statut).length; }

  // ── PDF ──
async generatePDF(p: FactureProforma): Promise<void> {
  this.generatingPdf = true;
  try {
    const full = await new Promise<any>((resolve, reject) => {
      this.proformaService.getById(p.id).subscribe({ next: resolve, error: reject });
    });

    const jspdfModule = await import('jspdf');
    const autotableModule = await import('jspdf-autotable');
    const jsPDF = jspdfModule.default || (jspdfModule as any).jsPDF;
    const autoTable = autotableModule.default || (autotableModule as any).autoTable;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' , putOnlyUsedFonts: true });
    (doc as any).setProperties({ margins: { top: 0, bottom: 0, left: 0, right: 0 } });

    const client: any = full.client || {};
    const lignes: any[] = full.lignes || [];

    const NOIR: [number, number, number] = [15, 23, 42];
    const GRIS: [number, number, number] = [100, 116, 139];
    const GRIS_L: [number, number, number] = [148, 163, 184];
    const WHITE: [number, number, number] = [255, 255, 255];
    const LIGHT: [number, number, number] = [248, 250, 252];
    const BORDER: [number, number, number] = [226, 232, 240];

    const W = 210, H = 297, ML = 14, MR = 14;

    doc.setFillColor(...WHITE);
    doc.rect(0, 0, W, H, 'F');

    // 1. LOGO
    const LOGO_X = 0;
    const LOGO_Y = -20;
    const LOGO_W = 90;
    const LOGO_H = 85;

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
    const INFO_Y = LOGO_Y + LOGO_H - 10;

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
const CX = 110;
const CY = INFO_Y - 20;
const CW = W - CX - MR;

// ── Nom : mesure avec la bonne font avant splitTextToSize ──
doc.setFont('helvetica', 'bold');
doc.setFontSize(10);
const nomRaw = (client.nom || '—').toUpperCase();
let nomLines = doc.splitTextToSize(nomRaw, CW - 8);
let nomFontSize = 10;
let nomLineHeight = 6;
if (nomLines.length > 1) {
  doc.setFontSize(9);
  nomLines = doc.splitTextToSize(nomRaw, CW - 8);
  nomFontSize = 9;
  nomLineHeight = 5;
}

// ── Adresse : mesure avec la bonne font avant splitTextToSize ──
let addressLines: string[] = [];
if (client.adresse) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  addressLines = doc.splitTextToSize(client.adresse.toUpperCase(), CW - 8);
}

// ── Calcul hauteur cadre ──
let textHeight = 0;
textHeight += nomLines.length * nomLineHeight;
textHeight += 2;
textHeight += addressLines.length * 6;
textHeight += 7; // cpVille
if (client.ice) textHeight += 5;
if (client.reference) textHeight += 5;
const CH = Math.max(44, textHeight + 16);

// ── Dessin du cadre ──
doc.setFillColor(...WHITE);
doc.setDrawColor(...NOIR);
doc.setLineWidth(0.3);
doc.roundedRect(CX, CY, CW, CH, 2, 2, 'FD');

let currentY = CY + 12;

// Nom
doc.setFont('helvetica', 'bold');
doc.setFontSize(nomFontSize);
doc.setTextColor(...NOIR);
nomLines.forEach((line: string) => {
  doc.text(line, CX + 3, currentY);
  currentY += nomLineHeight;
});
currentY += 2;

// Adresse
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(...NOIR);
if (addressLines.length > 0) {
  addressLines.forEach((line: string) => {
    doc.text(line, CX + 3, currentY);
    currentY += 6;
  });
}

// Code postal + ville
const cpVille = [client.codepostal, client.ville].filter(Boolean).join('     ').toUpperCase();
if (cpVille) {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(cpVille, CX + 3, currentY);
  currentY += 7;
} else {
  currentY += 7;
}

// ICE
if (client.ice) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NOIR);
  doc.text(`ICE: ${client.ice}`.toUpperCase(), CX + 3, currentY);
  currentY += 5;
}

// Numéro de page
doc.setFontSize(7.5);
doc.setFont('helvetica', 'normal');
doc.setTextColor(...GRIS_L);
doc.text('1/1', W - MR, CY + 5, { align: 'right' });

// N° client (sous le cadre)
if (client.reference) {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NOIR);
  doc.text(`N° CLIENT: ${client.reference}`.toUpperCase(), CX + 3, CY + CH + 5);
}

    // 4. BANDEAU "FACTURE PROFORMA N°" + date à droite
    const BY = CY + CH + 8;
    const BH = 9;

    const dateObj = full.date ? new Date(full.date) : new Date();
    const dateStr = dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).toUpperCase();

    const PAD = 4;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    const labelW = doc.getTextWidth('FACTURE PROFORMA N°');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const numeroW = doc.getTextWidth(full.numero || 'FP-XXXX');

    const LEFT_W = PAD + labelW + 4 + numeroW + PAD;

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(ML, BY, LEFT_W, BH);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NOIR);
    doc.text('FACTURE N°:', ML + PAD, BY + BH - 2.5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NOIR);
    doc.text(full.numero || 'FP-XXXX', ML + PAD + labelW + 4, BY + BH - 2.5);

    // Date alignée à droite de la page
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NOIR);
    doc.text(dateStr, W - MR, BY + BH - 2.5, { align: 'right' });

    // 5. TABLEAU PRODUITS
    const MIN_ROWS = 10;
    const bodyRows: any[] = [];

    lignes.forEach((l: any) => {
      const prix = Number(l.prix ?? 0);
      const total = Number(l.totalApresRemise ?? l.total ?? 0);
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
        d.line(cell.x, cell.y, cell.x, cell.y + cell.height);
        if (column.index === lastCol) {
          d.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
        }
        if (data.row.section === 'head') {
          d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
      },
    });

    // Fermer le tableau en bas
    const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? 200;
    const tableEndX = ML + 24 + 52 + 15 + 18 + 22 + 32 + 32;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(ML, tableEndY, tableEndX, tableEndY);

    // 6. BLOC TOTAUX
    const totalHT = Number(full.totalHT ?? 0);
    const totalRemise = Number(full.totalRemise ?? 0);
    const totalTVA = Number(full.totalTVA ?? 0);
    const totalTTC = Number(full.totalTTC ?? 0);

    const totRows = [
      { label: 'TOTAL HT',      value: `${totalHT.toFixed(2)} DH`,      bold: true },
      { label: 'TOTAL REMISE',  value: `- ${totalRemise.toFixed(2)} DH`, bold: false },
      { label: 'TVA',           value: `${totalTVA.toFixed(2)} DH`,      bold: false },
      { label: 'TOTAL TTC',     value: `${totalTTC.toFixed(2)} DH`,      bold: true },
      { label: 'RESTE À PAYER', value: `${totalTTC.toFixed(2)} DH`,      bold: true, red: true },
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

    // 7. FOOTER
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

    const pdfBlob = doc.output('blob');
    if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
    this.pdfPreviewBlobUrl = URL.createObjectURL(pdfBlob);
    this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfPreviewBlobUrl);
    this.pdfPreviewName = `${full.numero || 'DRAFT'}_${new Date().toISOString().slice(0, 10)}.pdf`;

  } catch (err) {
    console.error('PDF error:', err);
    this.showMessage('Erreur génération PDF', 'error');
  } finally {
    this.generatingPdf = false;
    this.cdr.detectChanges();
  }
}

  closePdfPreview(): void {
    if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
    this.pdfPreviewUrl = null;
    this.pdfPreviewBlobUrl = null;
    this.cdr.detectChanges();
  }

  downloadPdf(): void {
    if (!this.pdfPreviewBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.pdfPreviewBlobUrl;
    a.download = this.pdfPreviewName;
    a.click();
  }

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg; this.messageType = type;
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4500);
  }
}
