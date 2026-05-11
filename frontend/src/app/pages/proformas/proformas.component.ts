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
  generatePDF(p: FactureProforma): void {
    this.generatingPdf = true;
    this.proformaService.getById(p.id).subscribe({
      next: (full) => {
        const doc = new jsPDF();
        const primaryColor: [number, number, number] = [99, 102, 241];

        // Header
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('FACTURE PROFORMA', 14, 18);
        doc.setFontSize(11);
        doc.text(full.numero, 14, 28);
        doc.setFontSize(9);
        doc.text(new Date(full.date).toLocaleDateString('fr-FR'), 14, 35);

        // Statut
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(150, 8, 46, 12, 3, 3, 'F');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(full.statut, 173, 15.5, { align: 'center' });

        // Client
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Client :', 14, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(full.client?.nom || '—', 35, 52);
        if (full.client?.adresse) doc.text(full.client.adresse, 35, 58);
        if (full.client?.ville) doc.text(full.client.ville, 35, 64);
        if (full.client?.telephone) doc.text('Tél : ' + full.client.telephone, 35, 70);

        // Table produits
        const rows = (full.lignes || []).map(l => [
          l.produit?.reference || '',
          l.produit?.nom || '',
          Number(l.quantite).toFixed(2) + ' kg',
          Number(l.prix).toFixed(2) + ' DH',
          Number(l.remise).toFixed(0) + '%',
          Number(l.tva).toFixed(0) + '%',
          Number(l.totalApresRemise).toFixed(2) + ' DH',
          Number(l.totalTTC).toFixed(2) + ' DH',
        ]);

        autoTable(doc, {
          startY: 82,
          head: [['Réf.', 'Désignation', 'Qté', 'Prix/kg', 'Remise', 'TVA', 'HT net', 'TTC']],
          body: rows,
          headStyles: { fillColor: primaryColor, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8, textColor: [30,41,59] },
          alternateRowStyles: { fillColor: [249,250,251] },
          columnStyles: { 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'center'}, 5:{halign:'center'}, 6:{halign:'right'}, 7:{halign:'right'} },
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // Totaux
        const totals = [
          ['Total HT', Number(full.totalHT).toFixed(2) + ' DH'],
          ['Remises', '- ' + Number(full.totalRemise).toFixed(2) + ' DH'],
          ['HT net', (Number(full.totalHT) - Number(full.totalRemise)).toFixed(2) + ' DH'],
          ['TVA', Number(full.totalTVA).toFixed(2) + ' DH'],
          ['TOTAL TTC', Number(full.totalTTC).toFixed(2) + ' DH'],
        ];
        let ty = finalY;
        totals.forEach(([label, val], i) => {
          const isTTC = i === totals.length - 1;
          if (isTTC) {
            doc.setFillColor(...primaryColor);
            doc.rect(130, ty - 5, 70, 10, 'F');
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setTextColor(100, 116, 139);
          }
          doc.setFontSize(isTTC ? 10 : 9);
          doc.setFont('helvetica', isTTC ? 'bold' : 'normal');
          doc.text(label, 135, ty + 1);
          doc.text(val, 196, ty + 1, { align: 'right' });
          ty += 11;
        });

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Document non contractuel — Valable 30 jours', 105, 285, { align: 'center' });

        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        this.pdfPreviewBlobUrl = blobUrl;
        this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
        this.pdfPreviewName = `${full.numero}.pdf`;
        this.generatingPdf = false;
        this.cdr.detectChanges();
      },
      error: () => { this.generatingPdf = false; this.cdr.detectChanges(); }
    });
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
