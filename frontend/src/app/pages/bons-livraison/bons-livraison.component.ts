import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BonLivraisonService } from '../../services/bon-livraison.service';
import { ProduitService } from '../../services/produit.service';
import { ClientsService } from '../../services/clients.service';
import { FactureService } from '../../services/facture.service';
import { ProformaService } from '../../services/proforma.service';
import { BonLivraison, LigneBL } from '../../models/bon-livraison.model';
import { Produit } from '../../models/produit.model';

// jsPDF types
declare const window: any;

@Component({
  selector: 'app-bons-livraison',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './bons-livraison.component.html',
  styleUrl: './bons-livraison.component.scss',
})
export class BonsLivraisonComponent implements OnInit {
  bls: BonLivraison[] = [];
  filteredBls: BonLivraison[] = [];
  produits: Produit[] = [];
  clients: any[] = [];

  loading = false;
  loadingProduits = false;
  loadingClients = false;
  message = '';
  messageType: 'success' | 'error' = 'success';
  searchQuery = '';
  filterClient = '';
  filterStatut = '';
  filterDateFrom = '';
  filterDateTo = '';

  view: 'list' | 'create' | 'detail' | 'edit' = 'list';
  editingBl: BonLivraison | null = null;
  selectedBl: BonLivraison | null = null;
  deleteTarget: BonLivraison | null = null;
  deleting = false;
  saving = false;
  generatingPdf = false;

  // PDF Preview
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';

  // Create form state
  form = {
    clientId: 0 as number,
    lignes: [] as LigneBL[]
  };
  formValid = false;
  newLigne: LigneBL = { produitId: 0, nbUnites: 1, poidsUnitaire: 0, quantite: 0, prix: 0 };

  // Pagination
  currentPage = 1;
  pageSize = 10;

  // Selection for Facturation
  selectedBlIds = new Set<number>();

  constructor(
    private blService: BonLivraisonService,
    private produitService: ProduitService,
    private clientsService: ClientsService,
    private factureService: FactureService,
    private proformaService: ProformaService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadBls();
    this.loadProduits();
    this.loadClients();
  }

  // ── DATA ──
  loadBls(): void {
    this.loading = true;
    this.blService.getAll().subscribe({
      next: (data) => {
        this.bls = data;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadProduits(): void {
    this.produitService.getProduits().subscribe({
      next: (p) => {
        this.produits = p;
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (c) => {
        this.clients = c;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredBls = this.bls.filter(bl => {
      const matchSearch = !q || (bl.numero || '').toLowerCase().includes(q) || ((bl as any).client?.nom || '').toLowerCase().includes(q);
      const matchClient = !this.filterClient || bl.clientId === Number(this.filterClient);
      const matchStatut = !this.filterStatut || bl.statut === this.filterStatut;
      const blDate = new Date(bl.date);
      const matchDateFrom = !this.filterDateFrom || blDate >= new Date(this.filterDateFrom);
      const matchDateTo = !this.filterDateTo || blDate <= new Date(this.filterDateTo);
      return matchSearch && matchClient && matchStatut && matchDateFrom && matchDateTo;
    });
    this.currentPage = 1;
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
    this.bls.forEach(bl => {
      if (bl.client && !clients.has(bl.client.id)) {
        clients.set(bl.client.id, bl.client);
      }
    });
    return Array.from(clients.values());
  }

  // ════════════ SELECTION LOGIC ════════════

  toggleSelection(bl: any, event: Event): void {
    if ((bl as any).statut !== 'A FACTURER') return;
    if (this.selectedBlIds.has(bl.id)) {
      this.selectedBlIds.delete(bl.id);
    } else {
      this.selectedBlIds.add(bl.id);
    }
    this.cdr.detectChanges();
  }

  toggleAll(event: any): void {
    const checked = event.target.checked;
    if (checked) {
      this.pagedBls.forEach(bl => {
        if ((bl as any).statut === 'A FACTURER') {
          this.selectedBlIds.add(bl.id);
        }
      });
    } else {
      this.pagedBls.forEach(bl => this.selectedBlIds.delete(bl.id));
    }
    this.cdr.detectChanges();
  }

  isAllSelected(): boolean {
    const selectable = this.pagedBls.filter(b => (b as any).statut === 'A FACTURER');
    if (selectable.length === 0) return false;
    return selectable.every(b => b.id && this.selectedBlIds.has(b.id));
  }

  generateFactureFromSelection(): void {
    if (this.selectedBlIds.size === 0) return;
    
    const ids = Array.from(this.selectedBlIds);
    this.loading = true;
    
    this.factureService.generateFromBls(ids).subscribe({
      next: (facture) => {
        this.showMessage('Facture générée avec succès !', 'success');
        this.selectedBlIds.clear();
        this.loadBls();
        setTimeout(() => this.router.navigate(['/factures']), 1500);
      },
      error: (err) => {
        this.showMessage(err.error?.error || 'Erreur lors de la facturation', 'error');
        this.loading = false;
      }
    });
  }

  generateProformaFromSelection(): void {
    if (this.selectedBlIds.size === 0) return;
    
    const ids = Array.from(this.selectedBlIds);
    this.loading = true;
    
    this.proformaService.fromBls(ids).subscribe({
      next: (proforma) => {
        this.showMessage('Proforma générée avec succès !', 'success');
        this.selectedBlIds.clear();
        this.loadBls();
        setTimeout(() => this.router.navigate(['/proformas']), 1500);
      },
      error: (err) => {
        this.showMessage(err.error?.error || 'Erreur lors de la création de la proforma', 'error');
        this.loading = false;
      }
    });
  }

  // ── PAGINATION ──
  get pagedBls(): BonLivraison[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredBls.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredBls.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) this.currentPage = p;
  }

  // ── VIEWS ──
  openCreate(): void {
    this.form = { clientId: 0, lignes: [] };
    this.formValid = false;
    this.newLigne = { produitId: 0, quantite: 1, prix: 0 };
    this.view = 'create';
    this.cdr.detectChanges();
  }

  openDetail(bl: BonLivraison): void {
    this.blService.getById(bl.id!).subscribe({
      next: (full) => {
        this.selectedBl = full;
        console.log(full);
        
        this.view = 'detail';
        this.cdr.detectChanges();
      }
    });
  }

  backToList(): void {
    this.view = 'list';
    this.selectedBl = null;
    this.cdr.detectChanges();
  }

  // ── FORM HELPERS ──
  getProduit(id: number): Produit | undefined {
    return this.produits.find(p => p.id === Number(id));
  }

  getClient(id: number): any {
    return this.clients.find(c => c.id === Number(id));
  }

  onProduitChange(): void {
    const p = this.getProduit(Number(this.newLigne.produitId));
    if (p) {
      this.newLigne.prix = Number(p.prixUnitaire);
      this.newLigne.produitUnite = p.unite;
      this.newLigne.nbUnites = 1;
      this.newLigne.poidsUnitaire = Number(p.poidsUnitaire);
      this.updateLigneTotal(this.newLigne);
    }
  }

  addLigne(): void {
    const pid = Number(this.newLigne.produitId);
    if (!pid || (this.newLigne.nbUnites || 0) <= 0) return;
    const p = this.getProduit(pid);
    if (!p) return;

    const q = Number(this.newLigne.nbUnites || 0) * Number(this.newLigne.poidsUnitaire || 0);
    const total = q * Number(this.newLigne.prix || 0);

    this.form.lignes.push({
      produitId: pid,
      produitNom: p.nom,
      produitRef: p.reference,
      produitUnite: p.unite,
      nbUnites: Number(this.newLigne.nbUnites),
      poidsUnitaire: Number(this.newLigne.poidsUnitaire),
      quantite: q,
      prix: Number(this.newLigne.prix),
      total: total,
    });

    this.newLigne = { produitId: 0, nbUnites: 1, poidsUnitaire: 0, quantite: 0, prix: 0 };
    this.checkFormValid();
    this.cdr.detectChanges();
  }

  removeLigne(i: number): void { 
    this.form.lignes.splice(i, 1); 
    this.checkFormValid();
    this.cdr.detectChanges();
  }

  updateLigneTotal(l: LigneBL): void {
    l.quantite = Number(l.nbUnites || 0) * Number(l.poidsUnitaire || 0);
    l.total = l.quantite * Number(l.prix || 0);
  }

  get totalForm(): number {
    return this.form.lignes.reduce((s, l) => s + (l.quantite * l.prix), 0);
  }

  checkFormValid(): void {
    this.formValid = Number(this.form.clientId) > 0 && this.form.lignes.length > 0;
  }

  // ── SAVE ──
  saveBL(): void {
    if (!this.formValid || this.saving) return;
    this.saving = true;
    const payload = {
      clientId: Number(this.form.clientId),
      lignes: this.form.lignes.map(l => ({
        produitId: l.produitId,
        nbUnites: l.nbUnites,
        poidsUnitaire: l.poidsUnitaire,
        quantite: l.quantite,
        prix: l.prix,
      }))
    };
    this.blService.create(payload).subscribe({
      next: (created) => {
        this.showMessage(`✅ Bon ${created.numero} créé avec succès`, 'success');
        this.saving = false;
        this.view = 'list';
        this.loadBls();
        this.loadProduits(); // refresh stock
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.saving = false;
        const msg = e?.error?.error || 'Erreur lors de la création du BL';
        this.showMessage(`❌ ${msg}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ── EDIT ──
  openEdit(bl: BonLivraison): void {
    this.blService.getById(bl.id!).subscribe({
      next: (full) => {
        this.editingBl = full;
        const lignes = (full as any).lignes || [];
        this.form = {
          clientId: full.clientId,
          lignes: lignes.map((l: any) => ({
            produitId: l.produitId,
            produitNom: l.produit?.nom || '',
            produitRef: l.produit?.reference || '',
            produitUnite: l.produit?.unite || '',
            nbUnites: Number(l.nbUnites || 1),
            poidsUnitaire: Number(l.poidsUnitaire || 0),
            quantite: Number(l.quantite),
            prix: Number(l.prix),
            total: Number(l.total),
          }))
        };
        this.formValid = true;
        this.newLigne = { produitId: 0, nbUnites: 1, poidsUnitaire: 0, quantite: 0, prix: 0 };
        this.view = 'edit';
        this.cdr.detectChanges();
      }
    });
  }

  updateBL(): void {
    if (!this.formValid || this.saving || !this.editingBl) return;
    this.saving = true;
    const payload = {
      clientId: Number(this.form.clientId),
      lignes: this.form.lignes.map(l => ({
        produitId: l.produitId,
        nbUnites: l.nbUnites,
        poidsUnitaire: l.poidsUnitaire,
        quantite: l.quantite,
        prix: l.prix,
      }))
    };
    this.blService.update(this.editingBl.id, payload).subscribe({
      next: (updated) => {
        this.showMessage(`✅ Bon ${updated.numero} modifié avec succès`, 'success');
        this.saving = false;
        this.editingBl = null;
        this.view = 'list';
        this.loadBls();
        this.loadProduits();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.saving = false;
        const msg = e?.error?.error || 'Erreur lors de la modification du BL';
        this.showMessage(`❌ ${msg}`, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  confirmDelete(bl: BonLivraison): void { this.deleteTarget = bl; }
  cancelDelete(): void { this.deleteTarget = null; }

  executeDelete(): void {
    if (!this.deleteTarget?.id || this.deleting) return;
    this.deleting = true;
    this.blService.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.showMessage(`🗑️ ${this.deleteTarget!.numero} supprimé (stock restauré)`, 'success');
        this.deleteTarget = null;
        this.deleting = false;
        if (this.view === 'detail') this.view = 'list';
        this.loadBls();
        this.loadProduits();
        this.cdr.detectChanges();
      },
      error: () => {
        this.deleting = false;
        this.showMessage('Erreur lors de la suppression', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ── PDF ──
  async generatePDF(bl: BonLivraison): Promise<void> {
    this.generatingPdf = true;
    try {
      const jspdfModule = await import('jspdf');
      const autotableModule = await import('jspdf-autotable');
      const jsPDF = jspdfModule.default || (jspdfModule as any).jsPDF;
      const autoTable = autotableModule.default || (autotableModule as any).autoTable;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const client = (bl as any).client || {};
      const lignes = (bl as any).lignes || [];

      // ── HEADER BAR ──
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, 210, 36, 'F');

      // Company name
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('BÔDÉLICE', 15, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 210, 240);
      doc.text('Usine de production Shawarma & Tacos', 15, 25);
      doc.text('Casablanca, Maroc  |  Tel: +212 6XX-XXXXXX', 15, 31);

      // BL title on right
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('BON DE LIVRAISON', 210 - 15, 16, { align: 'right' });
      doc.setFontSize(13);
      doc.setTextColor(180, 210, 240);
      doc.text(bl.numero || '', 210 - 15, 25, { align: 'right' });

      // ── INFO BOXES ──
      const boxY = 44;

      // Left box — Client
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, boxY, 90, 44, 3, 3, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text('CLIENT', 20, boxY + 8);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(client.nom || '—', 20, boxY + 17);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      if (client.adresse) doc.text(client.adresse, 20, boxY + 25);
      if (client.telephone) doc.text(`Tel: ${client.telephone}`, 20, boxY + 32);
      if (client.ville) doc.text(client.ville, 20, boxY + 39);

      // Right box — BL Info
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(110, boxY, 86, 44, 3, 3, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text('DÉTAILS DU BON', 116, boxY + 8);

      const infoItems = [
        { label: 'N° BL', value: bl.numero || '' },
        { label: 'Date', value: bl.date ? new Date(bl.date).toLocaleDateString('fr-FR') : '' },
        { label: 'Lignes', value: `${lignes.length} produit${lignes.length > 1 ? 's' : ''}` },
      ];
      infoItems.forEach((item, i) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, 116, boxY + 17 + i * 9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(item.value, 185, boxY + 17 + i * 9, { align: 'right' });
      });

      // ── PRODUCTS TABLE ──
      const tableData = lignes.map((l: any) => [
        l.produit?.nom || '',
        l.nbUnites ? `${Number(l.nbUnites)} ${l.produit?.unite || ''}s` : '-',
        l.poidsUnitaire ? `${Number(l.poidsUnitaire).toFixed(2)}kg` : '-',
        `${Number(l.quantite).toFixed(2)} kg`,
        `${Number(l.prix).toFixed(2)} DH`,
        `${Number(l.total).toFixed(2)} DH`,
      ]);

      autoTable(doc, {
        startY: boxY + 52,
        head: [['Désignation', 'Unités', 'Poids/U', 'Poids Total', 'Prix/kg', 'Total']],
        body: tableData,
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [30, 58, 95],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        },
        foot: [[
          { content: '', colSpan: 4 },
          { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
          { content: `${Number(bl.total).toFixed(2)} DH`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } }
        ]],
      });

      // ── SIGNATURE AREA ──
      const finalY = (doc as any).lastAutoTable?.finalY || 180;
      const sigY = finalY + 20;

      if (sigY < 240) {
        doc.setDrawColor(226, 232, 240);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);

        doc.line(15, sigY + 15, 85, sigY + 15);
        doc.text("Signature Livreur", 50, sigY + 21, { align: 'center' });

        doc.line(125, sigY + 15, 195, sigY + 15);
        doc.text("Signature Client", 160, sigY + 21, { align: 'center' });
      }

      // ── FOOTER ──
      const pageH = 297;
      doc.setFillColor(30, 58, 95);
      doc.rect(0, pageH - 14, 210, 14, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 210, 240);
      doc.text('BÔDÉLICE — Document généré automatiquement', 105, pageH - 5, { align: 'center' });

      // Preview instead of direct download
      const pdfBlob = doc.output('blob');
      if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
      this.pdfPreviewBlobUrl = URL.createObjectURL(pdfBlob);
      this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfPreviewBlobUrl);
      this.pdfPreviewName = `${bl.numero || 'BL'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    } catch (err) {
      console.error('PDF error:', err);
      this.showMessage('Erreur génération PDF', 'error');
    } finally {
      this.generatingPdf = false;
      this.cdr.detectChanges();
    }
  }

  // ── UTILS ──
  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => { this.message = ''; }, 4500);
  }

  getStockDispo(produitId: number): number {
    return this.getProduit(produitId)?.quantite || 0;
  }

  trackByLigne(_i: number, l: LigneBL): number { return l.produitId; }

  // ── PDF PREVIEW ──
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

  // ── STATS HELPERS ──
  getBlCount(statut: string): number {
    return this.bls.filter(bl => (bl as any).statut === statut).length;
  }

  getBlTotal(): number {
    return this.bls.reduce((sum, bl) => sum + (Number(bl.total) || 0), 0);
  }
}
