import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AvoirService, FactureAvoir } from '../../services/avoir.service';
import { FactureService, Facture } from '../../services/facture.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-avoirs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './avoirs.component.html',
  styleUrl: './avoirs.component.scss'
})
export class AvoirsComponent implements OnInit {
  avoirs: FactureAvoir[] = [];
  filteredAvoirs: FactureAvoir[] = [];
  factures: Facture[] = [];
  loading = false;
  searchQuery = '';
  filterClient = '';
  filterDateFrom = '';
  filterDateTo = '';
  message = '';
  messageType: 'success' | 'error' = 'success';

  view: 'list' | 'detail' | 'create' = 'list';
  selectedAvoir: FactureAvoir | null = null;

  // Create form
  form = { factureId: 0, motif: '', lignes: [] as any[] };
  newLigne = { produitId: 0, quantite: 0, prix: 0 };
  selectedFacture: Facture | null = null;
  saving = false;

  // PDF
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';

  constructor(
    private avoirService: AvoirService,
    private factureService: FactureService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadAvoirs();
    this.loadFactures();

    this.route.queryParams.subscribe(params => {
      if (params['factureId']) {
        this.openCreate();
        this.form.factureId = Number(params['factureId']);
        this.onFactureChange();
      }
    });
  }

  loadAvoirs(): void {
    this.loading = true;
    this.avoirService.getAll().subscribe({
      next: (data) => {
        this.avoirs = data.map(a => ({
          ...a,
          total: Number(a.total),
          facture: a.facture ? {
            ...a.facture,
            total: Number(a.facture.total),
            reste: Number(a.facture.reste)
          } : undefined
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadFactures(): void {
    this.factureService.getAll().subscribe({
      next: (data) => {
        this.factures = data.map(f => ({
          ...f,
          total: Number(f.total),
          reste: Number(f.reste)
        }));
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredAvoirs = this.avoirs.filter(a => {
      const matchSearch = !q || a.numero.toLowerCase().includes(q) ||
        (a.facture?.client?.nom || '').toLowerCase().includes(q) ||
        (a.facture?.numero || '').toLowerCase().includes(q);
      const matchClient = !this.filterClient || a.facture?.clientId === Number(this.filterClient);
      const aDate = new Date(a.date);
      const matchDateFrom = !this.filterDateFrom || aDate >= new Date(this.filterDateFrom);
      const matchDateTo = !this.filterDateTo || aDate <= new Date(this.filterDateTo);
      return matchSearch && matchClient && matchDateFrom && matchDateTo;
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterClient = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.applyFilter();
  }

  getUniqueClients(): any[] {
    const clients = new Map<number, any>();
    this.avoirs.forEach(a => {
      if (a.facture?.client && !clients.has(a.facture.client.id)) {
        clients.set(a.facture.client.id, a.facture.client);
      }
    });
    return Array.from(clients.values());
  }

  get totalAvoirs(): number {
    return this.avoirs.reduce((s, a) => s + Number(a.total), 0);
  }

  openDetail(a: FactureAvoir): void {
    this.loading = true;
    this.avoirService.getById(a.id).subscribe({
      next: (full) => {
        this.selectedAvoir = {
          ...full,
          total: Number(full.total),
          lignes: (full.lignes || []).map(l => ({
            ...l,
            quantite: Number(l.quantite),
            nbUnites: l.nbUnites ? Number(l.nbUnites) : undefined,
            poidsUnitaire: l.poidsUnitaire ? Number(l.poidsUnitaire) : undefined,
            prix: Number(l.prix),
            total: Number(l.total)
          }))
        };
        this.view = 'detail';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  openCreate(): void {
    this.form = { factureId: 0, motif: '', lignes: [] };
    this.newLigne = { produitId: 0, quantite: 0, prix: 0 };
    this.selectedFacture = null;
    this.view = 'create';
    this.cdr.detectChanges();
  }

  backToList(): void {
    this.view = 'list'; this.selectedAvoir = null;
    this.cdr.detectChanges();
  }

  onFactureChange(): void {
    if (!this.form.factureId) { this.selectedFacture = null; return; }
    this.factureService.getById(Number(this.form.factureId)).subscribe({
      next: (f) => {
        this.selectedFacture = {
          ...f,
          total: Number(f.total),
          reste: Number(f.reste),
          bonsLivraison: (f.bonsLivraison || []).map((bl: any) => ({
            ...bl,
            total: Number(bl.total),
            lignes: (bl.lignes || []).map((l: any) => ({
              ...l,
              nbUnites: l.nbUnites ? Number(l.nbUnites) : null,
              poidsUnitaire: l.poidsUnitaire ? Number(l.poidsUnitaire) : null,
              quantite: Number(l.quantite),
              prix: Number(l.prix),
              total: Number(l.total)
            }))
          }))
        };
        this.form.lignes = [];
        this.cdr.detectChanges();
      }
    });
  }

  addLigneFromBl(bl: any, ligne: any): void {
    const exists = this.form.lignes.find(l => l.produitId === ligne.produitId);
    if (exists) {
      this.showMessage('Produit déjà ajouté à l\'avoir', 'error');
      return;
    }
    this.form.lignes.push({
      produitId: ligne.produitId,
      produitNom: ligne.produit?.nom || '',
      produitRef: ligne.produit?.reference || '',
      produitUnite: ligne.produit?.unite || '',
      nbUnites: Number(ligne.nbUnites || 0),
      poidsUnitaire: Number(ligne.poidsUnitaire || 0),
      quantite: Number(ligne.quantite),
      prix: Number(ligne.prix),
      total: Number(ligne.total),
      maxNbUnites: Number(ligne.nbUnites || 0),
      maxQte: Number(ligne.quantite),
    });
    this.cdr.detectChanges();
  }

  removeLigne(i: number): void {
    this.form.lignes.splice(i, 1);
    this.cdr.detectChanges();
  }

  updateLigneTotal(l: any): void {
    if (l.nbUnites !== undefined && l.poidsUnitaire !== undefined) {
      l.quantite = Number(l.nbUnites || 0) * Number(l.poidsUnitaire || 0);
    }
    l.total = Number(l.quantite || 0) * Number(l.prix || 0);
  }

  get formTotal(): number {
    return this.form.lignes.reduce((s, l) => s + (l.total || 0), 0);
  }

  get formValid(): boolean {
    return this.form.factureId > 0 && this.form.lignes.length > 0;
  }

  saveAvoir(): void {
    if (!this.formValid || this.saving) return;

    // Vérifier les quantités
    for (const l of this.form.lignes) {
      if (l.nbUnites > l.maxNbUnites) {
        this.showMessage(`Le nombre d'unités pour ${l.produitNom} ne peut pas dépasser ${l.maxNbUnites}`, 'error');
        return;
      }
      if (l.quantite > l.maxQte) {
        this.showMessage(`La quantité pour ${l.produitNom} ne peut pas dépasser ${l.maxQte}`, 'error');
        return;
      }
      if (l.nbUnites < 0 || l.quantite < 0) {
        this.showMessage(`La quantité pour ${l.produitNom} ne peut pas être négative`, 'error');
        return;
      }
    }

    this.saving = true;
    const payload = {
      factureId: Number(this.form.factureId),
      motif: this.form.motif || undefined,
      lignes: this.form.lignes.map(l => ({
        produitId: l.produitId,
        nbUnites: l.nbUnites,
        poidsUnitaire: l.poidsUnitaire,
        quantite: l.quantite,
        prix: l.prix,
      }))
    };
    this.avoirService.create(payload).subscribe({
      next: (created) => {
        this.saving = false;
        this.showMessage(`✅ Avoir ${created.numero} créé — stock restauré`, 'success');
        this.loadAvoirs();
        this.loadFactures();
        this.backToList();
      },
      error: (e) => {
        this.saving = false;
        this.showMessage('❌ ' + (e?.error?.error || 'Erreur'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  deleteAvoir(a: FactureAvoir): void {
    if (!confirm(`Supprimer ${a.numero} ? Le stock sera de nouveau déduit.`)) return;
    this.avoirService.delete(a.id).subscribe({
      next: () => {
        this.showMessage('✅ Avoir supprimé', 'success');
        this.loadAvoirs();
        this.loadFactures();
        if (this.view === 'detail') this.backToList();
      }
    });
  }

  // PDF
  async generatePDF(a: FactureAvoir): Promise<void> {
    this.avoirService.getById(a.id).subscribe({
      next: async (full) => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = 210, H = 297, ML = 14, MR = 14;

        const NOIR: [number, number, number] = [15, 23, 42];
        const GRIS: [number, number, number] = [100, 116, 139];
        const GRIS_L: [number, number, number] = [148, 163, 184];
        const WHITE: [number, number, number] = [255, 255, 255];
        const LIGHT: [number, number, number] = [248, 250, 252];
        const BORDER: [number, number, number] = [226, 232, 240];
        const ROUGE: [number, number, number] = [180, 30, 30];

        doc.setFillColor(...WHITE);
        doc.rect(0, 0, W, H, 'F');

        const client = full.facture?.client || {};

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
        const CH = 44;

        doc.setFillColor(...LIGHT);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.roundedRect(CX, CY, CW, CH, 2, 2, 'FD');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NOIR);
        doc.text((client.nom || '—').toUpperCase(), CX + 3, CY + 12);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...NOIR);
        if (client.adresse) doc.text(client.adresse.toUpperCase(), CX + 3, CY + 19);

        doc.setFont('helvetica', 'bold');
        const cpVille = [client.codepostal, client.ville].filter(Boolean).join('     ').toUpperCase();
        if (cpVille) doc.text(cpVille, CX + 3, CY + 26);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...NOIR);
        if (client.ice) doc.text(`ICE: ${client.ice}`.toUpperCase(), CX + 3, CY + 33);
        if (client.reference) doc.text(`RÉF: ${client.reference}`.toUpperCase(), CX + 3, CY + 37);
        if (client.id) doc.text(`N° CLIENT: ${client.id}`, CX + 3, client.reference ? CY + 41 : CY + 40);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRIS_L);
        doc.text('1/1', W - MR, CY + 5, { align: 'right' });

// 4. BANDEAU "FACTURE D'AVOIR N°" + Facture liée + date
        const BY = CY + CH + 25;
        const BH = 9;

        const dateObj = full.date ? new Date(full.date) : new Date();
        const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
        const rightText = full.facture?.numero ? `FACTURE: ${full.facture.numero} | ${dateStr}` : dateStr;

        // ── Mesure dynamique ─
        const PAD = 4;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        const labelW = doc.getTextWidth("FACTURE D'AVOIR N°");

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const numeroW = doc.getTextWidth(full.numero || 'AV-XXXX');

        const LEFT_W = PAD + labelW + 4 + numeroW + PAD;

        let RIGHT_W = 0;
        if (rightText) {
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          RIGHT_W = Math.max(60, PAD + doc.getTextWidth(rightText) + PAD);
        }

        const BW = LEFT_W + RIGHT_W;

        // ── Dessin du bandeau ─
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.rect(ML, BY, BW, BH);

        // Séparateur vertical
        if (rightText) {
          doc.line(ML + LEFT_W, BY, ML + LEFT_W, BY + BH);
        }

        // Cellule gauche : "FACTURE D'AVOIR N°" + numéro
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ROUGE);
        doc.text("FACTURE D'AVOIR N°", ML + 6, BY + BH - 2.5);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ROUGE);
        doc.text(full.numero || 'AV-XXXX', ML + PAD + labelW + 4, BY + BH - 2.5);

        // Cellule droite
        if (rightText) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NOIR);
          doc.text(rightText, 12 + LEFT_W + PAD, BY + BH - 2.5);
        }

        // 5. MOTIF (si présent)
        let startY = BY + BH + 6;
        if (full.motif) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text(`MOTIF: ${full.motif}`, ML, startY);
          startY += 6;
        }

        // 6. TABLEAU PRODUITS
        const rows = (full.lignes || []).map((l: any) => {
          const unite = l.produit?.unite || 'boule';
          const prix = Number(l.prix);
          const total = Number(l.total);
          const tva = Number(l.tva ?? l.produit?.tva ?? 0);
          return [
            (l.produit?.reference || '').toUpperCase(),
            (l.produit?.nom || '').toUpperCase(),
            `${tva}%`,
            l.nbUnites ? `${Number(l.nbUnites)}` : '-',
            unite,
            `- ${prix.toFixed(2)}`,
            `- ${total.toFixed(2)}`,
          ];
        });

        autoTable(doc, {
          startY: startY + 3,
          head: [['RÉF', 'DÉSIGNATION', 'TVA', 'QTE', 'UNITÉ', 'PRIX U HT', 'TOTAL HT']],
          body: rows,
          theme: 'plain',
          styles: {
            textColor: NOIR, lineColor: BORDER, lineWidth: 0.2, minCellHeight: 10, fillColor: WHITE,
          },
          headStyles: {
            fillColor: ROUGE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, lineColor: BORDER, lineWidth: 0.3,
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
        });

        // 6. BLOC TOTAUX
        const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? 200;
        const totalAvoir = Number(full.total ?? 0);

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
        doc.setTextColor(...ROUGE);
        doc.text('TOTAL', BOX_X + 3, textY);
        doc.text(`- ${totalAvoir.toFixed(2)} DH`, BOX_X + BOX_W - 3, textY, { align: 'right' });

        // TOTAL AVOIR en gras à droite du tableau (encadré)
        const summaryX = BOX_X + BOX_W + 8;
        const summaryY = tableEndY + 4;
        const summaryW = 55;
        const summaryH = 16;
        
        doc.setFillColor(...LIGHT);
        doc.setDrawColor(...ROUGE);
        doc.setLineWidth(0.5);
        doc.roundedRect(summaryX, summaryY, summaryW, summaryH, 2, 2, 'FD');
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ROUGE);
        doc.text('TOTAL AVOIR', summaryX + summaryW/2, summaryY + 4, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ROUGE);
        doc.text(`- ${totalAvoir.toFixed(2)} DH`, summaryX + summaryW/2, summaryY + 12, { align: 'center' });

        // 7. HISTORIQUE DES PAIEMENTS
        const paiements: any[] = (full as any).paiements || [];
        if (paiements.length > 0) {
          const payTableY = tableEndY + 10;

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NOIR);
          doc.text('HISTORIQUE DES PAIEMENTS', ML, payTableY);

          const tableStartY = payTableY + 5;
          const bodyRows = paiements.map((p: any) => {
            const pDate = p.date ? new Date(p.date) : new Date();
            const methodeLabel = this.getMethodeLabel(p.methode || 'ESPECE');
            return [
              ('0' + pDate.getDate()).slice(-2) + '/' + ('0' + (pDate.getMonth() + 1)).slice(-2) + '/' + pDate.getFullYear(),
              (p.libelle || methodeLabel).toUpperCase(),
              Number(p.montant || 0).toFixed(2) + ' DH',
            ];
          });
          const totalPaye = Number((full as any).paye ?? 0);

          autoTable(doc, {
            startY: tableStartY,
            margin: { left: ML },
            head: [['DATE', 'LIBELLÉ', 'MONTANT']],
            body: bodyRows,
            foot: [['', 'TOTAL PAYÉ', `${totalPaye.toFixed(2)} DH`]],
            theme: 'plain',
            styles: { textColor: NOIR, lineColor: BORDER, lineWidth: 0.2, fontSize: 7 },
            headStyles: { fillColor: LIGHT, textColor: NOIR, fontStyle: 'bold', fontSize: 7, lineColor: BORDER, lineWidth: 0.3 },
            footStyles: { fillColor: LIGHT, textColor: NOIR, fontStyle: 'bold', fontSize: 7, lineColor: BORDER, lineWidth: 0.3 },
            columnStyles: {
              0: { cellWidth: 20, halign: 'left' as const },
              1: { cellWidth: 35, halign: 'left' as const },
              2: { cellWidth: 25, halign: 'right' as const },
            },
          });
        }

        // 8. FOOTER
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

        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
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

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg; this.messageType = type;
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4500);
  }

  private getMethodeLabel(methode: string): string {
    const labels: Record<string, string> = {
      'ESPECE': 'Espèces',
      'CHEQUE': 'Chèque',
      'VIREMENT': 'Virement',
      'LETTRE_CHEQUE': 'Lettre de change',
      'TRAITE': 'Traite',
      'VERSEMENT': 'Versement',
      'MOBILE_MONEY': 'Mobile Money',
    };
    return labels[methode] || methode;
  }
}
