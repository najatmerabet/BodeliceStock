import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ClientsService } from '../../services/clients.service';
import { FactureService } from '../../services/facture.service';
import { Client } from '../../models/clients.model';
import { ClientFilesPageComponent } from '../client-files/client-files-page.component';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientFilesPageComponent],
  templateUrl: './client-detail-page.component.html',
  styleUrls: ['./client-detail-page.component.scss']
})
export class ClientDetailPageComponent implements OnInit {
  client!: Client;
  activeTab: 'info' | 'files' = 'info';
  editMode = false;
  editForm: any = {};
  loading = true;
  saving = false;
  toast = '';
  toastType: 'ok' | 'err' = 'ok';

  // Relevé State
  showReleveModal = false;
  releveDateFrom = '';
  releveDateTo = '';
  generatingReleve = false;
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = 'releve.pdf';

  get infoItems() {
    return [
      { icon: 'person', label: 'Nom', value: this.client?.nom || '-', color: '#059669' },
      { icon: 'badge', label: 'Référence', value: this.client?.reference || '-', color: '#2563EB' },
      { icon: 'fingerprint', label: 'ICE', value: this.client?.ice || '-', color: '#7C3AED' },
      { icon: 'mail', label: 'Email', value: this.client?.email || '-', color: '#DC2626' },
      { icon: 'phone', label: 'Téléphone', value: this.client?.telephone || '-', color: '#0891B2' },
      { icon: 'location_on', label: 'Adresse', value: this.client?.adresse || '-', color: '#EA580C' },
      { icon: 'location_city', label: 'Ville', value: this.client?.ville || '-', color: '#16A34A' },
      { icon: 'markunread_mailbox', label: 'Code Postal', value: this.client?.codepostal || '-', color: '#DB2777' },
    ];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientsService: ClientsService,
    private factureService: FactureService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const clientId = this.route.snapshot.paramMap.get('id');
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'files' || tabParam === 'info') {
      this.activeTab = tabParam;
    }

    if (clientId) {
      this.clientsService.getClient(+clientId).subscribe({
        next: (client) => {
          this.client = client;
          this.editForm = { ...client };
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/clients']);
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/clients']);
  }

  toggleEdit(): void {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.editForm = { ...this.client };
    }
  }

  cancelEdit(): void {
    this.editMode = false;
    this.editForm = { ...this.client };
  }

  saveClient(): void {
    this.saving = true;
    this.clientsService.updateClient(this.client.id!, this.editForm).subscribe({
      next: (updated) => {
        this.client = updated;
        this.editMode = false;
        this.saving = false;
        this.showToast('Client modifié avec succès', 'ok');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.showToast('Erreur lors de la modification', 'err');
        console.error('Update error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ── RELEVÉ DE COMPTE ──
  openReleveModal(): void {
    this.showReleveModal = true;
    this.releveDateFrom = '';
    this.releveDateTo = '';
    this.cdr.detectChanges();
  }

  closeReleveModal(): void {
    this.showReleveModal = false;
    this.cdr.detectChanges();
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

  async generateReleve(): Promise<void> {
    if (!this.client) return;
    this.generatingReleve = true;

    try {
      const data: any = await new Promise((resolve, reject) => {
        this.factureService.getReleveClient(
          this.client!.id!,
          this.releveDateFrom || undefined,
          this.releveDateTo || undefined
        ).subscribe({ next: resolve, error: reject });
      });

      const jspdfModule = await import('jspdf');
      const autotableModule = await import('jspdf-autotable');
      const jsPDF = jspdfModule.default || (jspdfModule as any).jsPDF;
      const autoTable = autotableModule.default || (autotableModule as any).autoTable;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297, H = 210, ML = 10, MR = 10;

      const NOIR: [number, number, number] = [30, 30, 30];
      const GRIS: [number, number, number] = [100, 116, 139];
      const WHITE: [number, number, number] = [255, 255, 255];
      const LIGHT: [number, number, number] = [248, 250, 252];
      const BORDER: [number, number, number] = [200, 210, 220];
      const BLUE: [number, number, number] = [37, 99, 235];
      const RED: [number, number, number] = [180, 30, 30];

      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, 'F');

      // ── LOGO ──
      const LOGO_X = ML, LOGO_Y = 8, LOGO_W = 35, LOGO_H = 35;
      try {
        const logoImg = new Image();
        logoImg.src = 'assets/logo.png';
        await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); setTimeout(resolve, 500); });
        if (logoImg.complete) doc.addImage(logoImg, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
      } catch (e) {}

      // ── INFOS ENTREPRISE ──
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NOIR);
      doc.text('PRODMEAT', ML, LOGO_Y + LOGO_H + 4);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS);
      ['BD MLY ISMAIL RES MLY ISMAIL N°22 ETG 5 - N 19 - TANGER',
       'TÉL : 06 66 57 03 03  |  MAIL : SECRETARIATPRODMEAT@GMAIL.COM',
       'ICE : 003291478000039  |  N° ONSSA: MAPAV.34.21.24'
      ].forEach((line, i) => doc.text(line, ML, LOGO_Y + LOGO_H + 8 + i * 4));

      // ── TITRE ──
      const titleX = LOGO_W + ML + 10;
      doc.setFillColor(...BLUE);
      doc.rect(titleX, LOGO_Y, W - titleX - MR, 14, 'F');
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text('RELEVÉ DE COMPTE CLIENT', titleX + 4, LOGO_Y + 9);

      // Sous-titre dynamique
      const hasFilter = this.releveDateFrom || this.releveDateTo;
      if (hasFilter) {
        const fromStr = this.releveDateFrom ? new Date(this.releveDateFrom).toLocaleDateString('fr-FR') : 'Début';
        const toStr   = this.releveDateTo   ? new Date(this.releveDateTo).toLocaleDateString('fr-FR')   : "Aujourd'hui";
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(`Période: ${fromStr} — ${toStr}`, titleX + 4, LOGO_Y + 12.5);
      }

      // ── INFOS DOCUMENT ──
      const infoY = LOGO_Y + 16;
      const periodLabel = (this.releveDateFrom || this.releveDateTo)
        ? `${this.releveDateFrom ? new Date(this.releveDateFrom).toLocaleDateString('fr-FR') : 'Début'} — ${this.releveDateTo ? new Date(this.releveDateTo).toLocaleDateString('fr-FR') : "Aujourd'hui"}`
        : 'Toutes les périodes';
      const infoData = [
        ['Client :', (data.client?.nom || '—').toUpperCase()],
        ['ICE :', data.client?.ice || '—'],
        ['Période :', periodLabel],
        ['Édité le :', new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
      ];

      doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
      doc.rect(titleX, infoY, W - titleX - MR, 22, 'FD');
      infoData.forEach(([label, value], i) => {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRIS);
        doc.text(label, titleX + 3, infoY + 5 + i * 5);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...NOIR);
        doc.text(value, titleX + 30, infoY + 5 + i * 5);
      });

      // ── TABLEAU ──
      const tableStartY = Math.max(LOGO_Y + LOGO_H + 20, infoY + 24);
      const client = data.client;

      const statutLabel = (s: string) => {
        if (s === 'payée') return 'PAYÉE';
        if (s === 'partielle') return 'PARTIELLE';
        return 'IMPAYÉE';
      };

      const rows = (data.factures || []).map((f: any) => [
        f.numero,
        (client?.nom || '').toUpperCase(),
        new Date(f.date).toLocaleDateString('fr-FR'),
        new Date(f.date).toLocaleDateString('fr-FR'),
        statutLabel(f.statut),
        Number(f.total).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
        Number(f.paye).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
        Number(f.reste).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
      ]);

      const totaux = data.totaux;
      const footerRow = [
        '', 'TOTAL GÉNÉRAL', '', '', '',
        Number(totaux.totalFacture).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
        Number(totaux.totalPaye).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
        Number(totaux.totalReste).toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
      ];

      const GREEN: [number, number, number] = [21, 128, 61];
      const ORANGE: [number, number, number] = [180, 83, 9];

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: ML, right: MR },
        head: [['N° Facture', 'Client', 'Date Facture', 'Date Échéance', 'Statut', 'Total Facture', 'Montant Payé', 'Reste à Payer']],
        body: rows,
        foot: [footerRow],
        theme: 'plain',
        styles: { textColor: NOIR, lineColor: BORDER, lineWidth: 0.2, fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85], textColor: WHITE, fontStyle: 'bold', fontSize: 8, lineColor: [51, 65, 85] },
        footStyles: { fillColor: LIGHT, textColor: NOIR, fontStyle: 'bold', fontSize: 8.5, lineColor: BORDER },
        alternateRowStyles: { fillColor: [250, 251, 253] },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' as const },
          1: { cellWidth: 52, halign: 'left' as const },
          2: { cellWidth: 24, halign: 'center' as const },
          3: { cellWidth: 24, halign: 'center' as const },
          4: { cellWidth: 22, halign: 'center' as const },
          5: { cellWidth: 30, halign: 'right' as const },
          6: { cellWidth: 30, halign: 'right' as const },
          7: { cellWidth: 30, halign: 'right' as const },
        },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'body' && cellData.column.index === 4) {
            const val = cellData.cell.text[0];
            if (val === 'PAYÉE') { cellData.cell.styles.textColor = GREEN; cellData.cell.styles.fontStyle = 'bold'; }
            else if (val === 'PARTIELLE') { cellData.cell.styles.textColor = ORANGE; cellData.cell.styles.fontStyle = 'bold'; }
            else { cellData.cell.styles.textColor = RED; cellData.cell.styles.fontStyle = 'bold'; }
          }
          if (cellData.section === 'body' && cellData.column.index === 7) {
            const rowIdx = cellData.row.index;
            const reste = Number((data.factures || [])[rowIdx]?.reste || 0);
            if (reste > 0) { cellData.cell.styles.textColor = RED; cellData.cell.styles.fontStyle = 'bold'; }
          }
          if (cellData.section === 'foot' && cellData.column.index === 7) {
            cellData.cell.styles.textColor = totaux.totalReste > 0 ? RED : GREEN;
          }
        }
      });

      // ── BOÎTE TOTAL RESTE ──
      const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? 160;
      const BOX_W = 80, BOX_H = 18;
      const BOX_X = W - MR - BOX_W, BOX_Y = tableEndY + 5;
      doc.setFillColor(...RED); doc.setDrawColor(...RED); doc.setLineWidth(0);
      doc.roundedRect(BOX_X, BOX_Y, BOX_W, BOX_H, 2, 2, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
      doc.text('TOTAL RESTANT DÛ', BOX_X + BOX_W / 2, BOX_Y + 5.5, { align: 'center' });
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text(
        Number(totaux.totalReste).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DH',
        BOX_X + BOX_W / 2, BOX_Y + 13.5, { align: 'center' }
      );

      // ── MESSAGE VIDE ──
      if (data.factures.length === 0) {
        doc.setFontSize(12); doc.setTextColor(...GRIS); doc.setFont('helvetica', 'italic');
        doc.text('✓ Aucune facture trouvée pour cette période', W / 2, tableStartY + 20, { align: 'center' });
      }

      // ── FOOTER ──
      const FY = H - 12;
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
      doc.line(ML, FY, W - MR, FY);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS);
      doc.text('PRODMEAT — AKEAD® Bôdélice Stock', W / 2, FY + 4, { align: 'center' });
      doc.text('ICE : 003291478000039   R.C: 1328011   Attijariwafa Bank  007 640 00 14335000003128 43', W / 2, FY + 8, { align: 'center' });

      const pdfBlob = doc.output('blob');
      if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
      this.pdfPreviewBlobUrl = URL.createObjectURL(pdfBlob);
      this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfPreviewBlobUrl);
      const clientNom = (data.client?.nom || 'CLIENT').replace(/\s+/g, '_').toUpperCase();
      this.pdfPreviewName = `RELEVE_${clientNom}_${new Date().toISOString().slice(0, 10)}.pdf`;
      this.showReleveModal = false;
    } catch (err) {
      console.error('Erreur génération relevé:', err);
      this.showToast('Erreur génération PDF', 'err');
    } finally {
      this.generatingReleve = false;
      this.cdr.detectChanges();
    }
  }

  showToast(msg: string, type: 'ok' | 'err'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => { this.toast = ''; this.cdr.detectChanges(); }, 3500);
    this.cdr.detectChanges();
  }
}