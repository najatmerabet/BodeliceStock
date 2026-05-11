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
  generatePDF(a: FactureAvoir): void {
    this.avoirService.getById(a.id).subscribe({
      next: (full) => {
        const doc = new jsPDF();
        const color: [number, number, number] = [220, 38, 38];

        doc.setFillColor(...color);
        doc.rect(0, 0, 210, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.text("FACTURE D'AVOIR", 14, 18);
        doc.setFontSize(11); doc.text(full.numero, 14, 28);
        doc.setFontSize(9); doc.text(new Date(full.date).toLocaleDateString('fr-FR'), 14, 35);

        doc.setTextColor(30, 41, 59); doc.setFontSize(10);
        doc.setFont('helvetica', 'bold'); doc.text('Facture liée :', 14, 50);
        doc.setFont('helvetica', 'normal'); doc.text(full.facture?.numero || '—', 50, 50);
        doc.setFont('helvetica', 'bold'); doc.text('Client :', 14, 57);
        doc.setFont('helvetica', 'normal'); doc.text(full.facture?.client?.nom || '—', 50, 57);
        if (full.motif) { doc.text('Motif : ' + full.motif, 14, 67); }

        const rows = (full.lignes || []).map(l => [
          l.produit?.reference || '',
          l.produit?.nom || '',
          (l.nbUnites ? Number(l.nbUnites).toFixed(0) + ' ' + (l.produit?.unite || '') + '(s) × ' + Number(l.poidsUnitaire).toFixed(2) + 'kg = ' : '') + Number(l.quantite).toFixed(2) + ' kg',
          Number(l.prix).toFixed(2) + ' DH',
          Number(l.total).toFixed(2) + ' DH',
        ]);

        autoTable(doc, {
          startY: full.motif ? 75 : 68,
          head: [['Réf.', 'Désignation', 'Qté retournée', 'Prix/kg', 'Total']],
          body: rows,
          headStyles: { fillColor: color, textColor: [255,255,255], fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: [30,41,59] },
          columnStyles: { 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'} },
        });

        const fy = (doc as any).lastAutoTable.finalY + 14;
        doc.setFillColor(...color);
        doc.rect(130, fy - 5, 66, 12, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('TOTAL AVOIR', 135, fy + 2);
        doc.text(Number(full.total).toFixed(2) + ' DH', 193, fy + 2, { align: 'right' });

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
}
