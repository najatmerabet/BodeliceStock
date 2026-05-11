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
  generatePDF(f: Facture): void {
    this.factureService.getById(f.id).subscribe({
      next: (full: any) => {
        const doc = new jsPDF();
        const color: [number, number, number] = [99, 102, 241];

        doc.setFillColor(...color);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.text('FACTURE', 14, 18);
        doc.setFontSize(11); doc.text(full.numero, 14, 30);
        doc.setFontSize(9); doc.text(new Date(full.date).toLocaleDateString('fr-FR'), 14, 37);

        doc.setTextColor(30, 41, 59); doc.setFontSize(10);
        doc.setFont('helvetica', 'bold'); doc.text('Client :', 14, 52);
        doc.setFont('helvetica', 'normal'); doc.text(full.client?.nom || '—', 50, 52);
        doc.setFont('helvetica', 'bold'); doc.text('Adresse :', 14, 59);
        doc.setFont('helvetica', 'normal'); doc.text(full.client?.adresse || '—', 50, 59);

        let lignes: any[] = [];
        if (full.proforma) {
          lignes = full.proforma.lignes.map((l: any) => ({
            produit: l.produit,
            quantite: l.quantite,
            prix: l.prix,
            total: l.total,
            nbUnites: l.nbUnites,
            poidsUnitaire: l.poidsUnitaire
          }));
        } else if (full.bonsLivraison) {
          lignes = (full.bonsLivraison || []).reduce((acc: any[], bl: any) => {
            return acc.concat((bl.lignes || []).map((l: any) => ({
              produit: l.produit,
              quantite: l.quantite,
              prix: l.prix,
              total: l.total,
              nbUnites: l.nbUnites,
              poidsUnitaire: l.poidsUnitaire
            })));
          }, []);
        }

        const rows = lignes.map((l: any) => {
          const qteDisplay = l.nbUnites 
            ? Number(l.nbUnites).toFixed(0) + ' × ' + Number(l.poidsUnitaire).toFixed(2) + 'kg'
            : '-';
          const totalKg = Number(l.quantite).toFixed(2) + ' kg';
          return [
            l.produit?.reference || '',
            l.produit?.nom || '',
            qteDisplay,
            totalKg,
            Number(l.prix).toFixed(2) + ' DH',
            Number(l.total).toFixed(2) + ' DH',
          ];
        });

        autoTable(doc, {
          startY: 68,
          head: [['Réf.', 'Désignation', 'Colis', 'Qté (kg)', 'Prix/kg', 'Total']],
          body: rows,
          headStyles: { fillColor: color, textColor: [255,255,255], fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: [30,41,59] },
          columnStyles: { 2:{halign:'center'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'} },
        });

        const fy = (doc as any).lastAutoTable.finalY + 14;
        
        const total = Number(full.total) || 0;
        const paye = Number(full.paye) || 0;
        const reste = Number(full.reste) || 0;
        
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Total HT :', 130, fy);
        doc.setFont('helvetica', 'normal'); doc.text(Number(full.totalHT || 0).toFixed(2) + ' DH', 190, fy, { align: 'right' });
        
        doc.setFont('helvetica', 'bold'); doc.text('TVA (20%) :', 130, fy + 7);
        doc.setFont('helvetica', 'normal'); doc.text(Number(full.totalTVA || 0).toFixed(2) + ' DH', 190, fy + 7, { align: 'right' });

        if (full.statut === 'partielle' || full.statut === 'impayée') {
          doc.setFont('helvetica', 'bold'); doc.text('Payé :', 130, fy + 14);
          doc.setFont('helvetica', 'normal'); doc.text(paye.toFixed(2) + ' DH', 190, fy + 14, { align: 'right' });
          
          doc.setFont('helvetica', 'bold'); doc.text('Reste :', 130, fy + 21);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(220, 38, 38);
          doc.text(reste.toFixed(2) + ' DH', 190, fy + 21, { align: 'right' });
          doc.setTextColor(30, 41, 59);
        }
        
        doc.setFillColor(...color);
        doc.rect(130, full.statut === 'partielle' || full.statut === 'impayée' ? fy + 28 : fy + 12, 66, 12, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('TOTAL TTC', 135, full.statut === 'partielle' || full.statut === 'impayée' ? fy + 35 : fy + 19);
        doc.text(total.toFixed(2) + ' DH', 193, full.statut === 'partielle' || full.statut === 'impayée' ? fy + 35 : fy + 19, { align: 'right' });

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
