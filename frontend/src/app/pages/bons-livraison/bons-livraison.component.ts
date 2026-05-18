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
import { PrixClientService } from '../../services/prix-client.service';
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

  // Prix client
  prixClientCache = new Map<number, number>(); // produitId → prix spécifique
  resolvingPrice = false;
  newLignePrixSpecifique = false; // indique si le prix affiché est un prix client

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
    private prixClientService: PrixClientService,
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
    this.prixClientCache.clear();
    this.newLignePrixSpecifique = false;
    this.view = 'create';
    this.cdr.detectChanges();
  }

  // Appelé quand le client change dans le formulaire
  onClientChange(): void {
    console.log('Client changé:', this.form.clientId);
    this.prixClientCache.clear();
    this.newLignePrixSpecifique = false;

    const clientId = Number(this.form.clientId);

    // 1. Mettre à jour le prix de la "nouvelle ligne" en cours de saisie
    if (this.newLigne.produitId && clientId > 0) {
      this.resolvePrixForLigne(Number(this.newLigne.produitId));
    } else if (this.newLigne.produitId) {
      const p = this.getProduit(Number(this.newLigne.produitId));
      if (p) this.newLigne.prix = Number(p.prixUnitaire);
    }

    // 2. Mettre à jour les prix de TOUTES les lignes déjà ajoutées
    if (clientId > 0 && this.form.lignes.length > 0) {
      console.log('Mise à jour des prix pour', this.form.lignes.length, 'lignes existantes');
      this.form.lignes.forEach(ligne => {
        this.prixClientService.resolve(clientId, ligne.produitId).subscribe({
          next: (res) => {
            ligne.prix = res.prix;
            this.updateLigneTotal(ligne);
            this.cdr.detectChanges();
          }
        });
      });
    }

    this.checkFormValid();
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
    const rawId = this.newLigne.produitId;
    if (!rawId || Number(rawId) === 0) {
      this.newLigne.prix = 0;
      this.newLignePrixSpecifique = false;
      return;
    }

    const p = this.getProduit(Number(rawId));
    if (!p) return;

    console.log('[BL] Produit changé:', p.nom, '(ID:', p.id, ')');

    // Valeurs par défaut depuis le produit (BASELINE)
    this.newLigne.produitUnite = p.unite;
    this.newLigne.nbUnites = 1;
    this.newLigne.poidsUnitaire = Number(p.poidsUnitaire);
    this.newLigne.prix = Number(p.prixUnitaire); // Prix standard par défaut
    this.newLignePrixSpecifique = false;
    this.updateLigneTotal(this.newLigne);

    // Si un client est sélectionné → tenter de résoudre un prix spécifique
    const clientId = Number(this.form.clientId);
    if (clientId > 0) {
      this.resolvePrixForLigne(p.id!);
    } else {
      this.cdr.detectChanges();
    }
  }

  private resolvePrixForLigne(produitId: number): void {
    const clientId = Number(this.form.clientId);
    if (!clientId || !produitId) return;

    // Vérifier le cache
    if (this.prixClientCache.has(produitId)) {
      const cached = this.prixClientCache.get(produitId)!;
      console.log('[BL] Prix résolu (CACHE):', cached);
      this.newLigne.prix = cached;
      this.newLignePrixSpecifique = true;
      this.updateLigneTotal(this.newLigne);
      this.cdr.detectChanges();
      return;
    }

    this.resolvingPrice = true;
    this.prixClientService.resolve(clientId, produitId).subscribe({
      next: (res) => {
        console.log('[BL] Prix résolu (API):', res);
        this.newLigne.prix = res.prix;
        this.newLignePrixSpecifique = res.isSpecifique;
        
        if (res.isSpecifique) {
          this.prixClientCache.set(produitId, res.prix);
        }
        
        this.updateLigneTotal(this.newLigne);
        this.resolvingPrice = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[BL] Erreur résolution prix:', err);
        this.resolvingPrice = false;
        // On garde le prix standard déjà mis dans onProduitChange
        this.cdr.detectChanges();
      }
    });
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
      const W = 210, H = 297, ML = 14, MR = 14;

      const NOIR: [number, number, number] = [15, 23, 42];
      const GRIS: [number, number, number] = [100, 116, 139];
      const GRIS_L: [number, number, number] = [148, 163, 184];
      const WHITE: [number, number, number] = [255, 255, 255];
      const LIGHT: [number, number, number] = [248, 250, 252];
      const BORDER: [number, number, number] = [226, 232, 240];

      doc.setFillColor(...WHITE);
      doc.rect(0, 0, W, H, 'F');

      const client = (bl as any).client || {};
      const lignes = (bl as any).lignes || [];

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

      const totRows = [
        { label: 'TOTAL', value: `${totalBL.toFixed(2)} DH`, bold: true },
      ];

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

      // TOTAL TTC en gras à droite du tableau (encadré)
      const summaryX = BOX_X + BOX_W + 8;
      const summaryY = tableEndY + 4;
      const summaryW = 55;
      const summaryH = 16;
      
      doc.setFillColor(...LIGHT);
      doc.setDrawColor(...NOIR);
      doc.setLineWidth(0.5);
      doc.roundedRect(summaryX, summaryY, summaryW, summaryH, 2, 2, 'FD');
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRIS);
      doc.text('TOTAL', summaryX + summaryW/2, summaryY + 4, { align: 'center' });
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NOIR);
      doc.text(`${totalBL.toFixed(2)} DH`, summaryX + summaryW/2, summaryY + 12, { align: 'center' });

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
