import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PorteurService, PorteurAffaire, RapportLine } from '../../services/porteur.service';
import { ClientsService } from '../../services/clients.service';
import { Client } from '../../models/clients.model';

@Component({
  selector: 'app-porteurs-affaire',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './porteurs-affaire.component.html',
  styleUrl: './porteurs-affaire.component.scss'
})
export class PorteursAffaireComponent implements OnInit {
  activeTab: 'porteurs' | 'rapport' = 'porteurs';
  
  // Porteurs State
  porteurs: PorteurAffaire[] = [];
  allClients: Client[] = [];
  selectedPorteur: PorteurAffaire | null = null;
  
  // Modals visibility
  showPorteurModal = false;
  editMode = false;
  porteurForm = { id: 0, nom: '', telephone: '', email: '' };
  
  showClientLinkModal = false;
  clientToLink: string = '';
  commissionRateToLink: number = 0;

  // Category Commissions Modal State
  showCommissionsModal = false;
  editingClient: Client | null = null;
  categories: string[] = [];
  clientCommissions: { categorie: string; commission: number }[] = [];
  savingCommissions = false;

  // Rapport State
  rapportPorteurId: string = '';
  rapportMois: string = '';
  rapportLines: RapportLine[] = [];
  totaux = { totalRestaurant: 0, totalPorteur: 0, totalAvoir: 0 };
  loadingRapport = false;
  generatingPdf = false;

  // PDF Preview
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';

  // Pagination Rapport
  pageSize = 10;
  currentPage = 1;

  // Toast
  toast = '';
  toastType: 'ok' | 'err' = 'ok';

  constructor(
    private porteurService: PorteurService,
    private clientsService: ClientsService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Initialiser le mois au mois actuel (YYYY-MM)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    this.rapportMois = `${year}-${month}`;

    this.loadPorteurs();
    this.loadClients();
    this.loadCategories();
  }

  loadPorteurs(): void {
    this.porteurService.getPorteurs().subscribe({
      next: (data) => {
        this.porteurs = data;
        if (this.selectedPorteur) {
          const updated = data.find(p => p.id === this.selectedPorteur?.id);
          this.selectedPorteur = updated || null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des porteurs:', err);
        this.showToast('Erreur lors du chargement des porteurs', 'err');
      }
    });
  }

  loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (data) => {
        this.allClients = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement clients:', err)
    });
  }

  showToast(msg: string, type: 'ok' | 'err'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toast = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  // --- CRUD Porteurs ---
  openAddPorteur(): void {
    this.editMode = false;
    this.porteurForm = { id: 0, nom: '', telephone: '', email: '' };
    this.showPorteurModal = true;
  }

  openEditPorteur(p: PorteurAffaire): void {
    this.editMode = true;
    this.porteurForm = {
      id: p.id || 0,
      nom: p.nom,
      telephone: p.telephone || '',
      email: p.email || ''
    };
    this.showPorteurModal = true;
  }

  closePorteurModal(): void {
    this.showPorteurModal = false;
  }

  savePorteur(): void {
    if (!this.porteurForm.nom.trim()) {
      this.showToast('Le nom est obligatoire', 'err');
      return;
    }

    const payload: PorteurAffaire = {
      nom: this.porteurForm.nom.trim(),
      telephone: this.porteurForm.telephone.trim() || undefined,
      email: this.porteurForm.email.trim() || undefined
    };

    if (this.editMode) {
      this.porteurService.updatePorteur(this.porteurForm.id, payload).subscribe({
        next: () => {
          this.showToast('Porteur mis à jour', 'ok');
          this.showPorteurModal = false;
          this.loadPorteurs();
        },
        error: (err) => {
          this.showToast(err?.error?.error || 'Erreur lors de la modification', 'err');
        }
      });
    } else {
      this.porteurService.addPorteur(payload).subscribe({
        next: () => {
          this.showToast('Porteur créé avec succès', 'ok');
          this.showPorteurModal = false;
          this.loadPorteurs();
        },
        error: (err) => {
          this.showToast(err?.error?.error || 'Erreur lors de la création', 'err');
        }
      });
    }
  }

  deletePorteur(p: PorteurAffaire): void {
    if (!confirm(`Supprimer le porteur "${p.nom}" ? Tous ses clients seront dissociés.`)) return;

    this.porteurService.deletePorteur(p.id!).subscribe({
      next: () => {
        this.showToast('Porteur supprimé', 'ok');
        if (this.selectedPorteur?.id === p.id) {
          this.selectedPorteur = null;
        }
        this.loadPorteurs();
        this.loadClients(); // reload clients list since they were dissociated
      },
      error: (err) => {
        this.showToast('Erreur lors de la suppression', 'err');
      }
    });
  }

  selectPorteur(p: PorteurAffaire): void {
    this.selectedPorteur = p;
  }

  // --- Association Clients & Commissions ---
  openLinkClient(): void {
    this.clientToLink = '';
    this.commissionRateToLink = 0;
    this.showClientLinkModal = true;
  }

  closeLinkClientModal(): void {
    this.showClientLinkModal = false;
  }

  getAvailableClients(): Client[] {
    // Filtre les clients qui ne sont pas déjà associés à ce porteur
    if (!this.selectedPorteur) return [];
    return this.allClients.filter(c => c.porteurId !== this.selectedPorteur?.id);
  }

  linkClient(): void {
    if (!this.selectedPorteur || !this.clientToLink) {
      this.showToast('Veuillez sélectionner un client', 'err');
      return;
    }

    const clientIdNum = parseInt(this.clientToLink);
    const client = this.allClients.find(c => c.id === clientIdNum);

    if (!client) return;

    const updatedClient: Client = {
      ...client,
      porteurId: this.selectedPorteur.id,
      commissionRate: this.commissionRateToLink
    };

    this.clientsService.updateClient(clientIdNum, updatedClient).subscribe({
      next: () => {
        this.showToast('Client associé avec succès', 'ok');
        this.showClientLinkModal = false;
        this.loadPorteurs();
        this.loadClients();
      },
      error: (err) => {
        console.error(err);
        this.showToast('Erreur lors de l\'association du client', 'err');
      }
    });
  }

  unlinkClient(client: Client): void {
    if (!confirm(`Dissocier le client "${client.nom}" de ce porteur ?`)) return;

    const updatedClient: Client = {
      ...client,
      porteurId: null,
      commissionRate: null
    };

    this.clientsService.updateClient(client.id!, updatedClient).subscribe({
      next: () => {
        this.showToast('Client dissocié', 'ok');
        this.loadPorteurs();
        this.loadClients();
      },
      error: (err) => {
        console.error(err);
        this.showToast('Erreur lors de la dissociation', 'err');
      }
    });
  }

  loadCategories(): void {
    this.porteurService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement categories:', err)
    });
  }

  openCommissions(client: Client): void {
    this.editingClient = client;
    this.clientCommissions = [];
    this.showCommissionsModal = true;
    this.cdr.detectChanges();

    this.porteurService.getClientCommissions(client.id!).subscribe({
      next: (data) => {
        const loadedMap = new Map<string, number>();
        data.forEach(c => {
          loadedMap.set(c.categorie.toLowerCase().trim(), Number(c.commission));
        });

        this.clientCommissions = this.categories.map(cat => {
          const normCat = cat.toLowerCase().trim();
          return {
            categorie: cat,
            commission: loadedMap.has(normCat) ? loadedMap.get(normCat)! : 0
          };
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.showToast('Erreur lors du chargement des commissions', 'err');
      }
    });
  }

  closeCommissionsModal(): void {
    this.showCommissionsModal = false;
    this.editingClient = null;
    this.clientCommissions = [];
  }

  saveCommissions(): void {
    if (!this.editingClient) return;

    this.savingCommissions = true;
    const clientId = this.editingClient.id!;
    const payload = this.clientCommissions.map(c => ({
      categorie: c.categorie,
      commission: Number(c.commission || 0)
    }));

    this.porteurService.saveClientCommissions(clientId, payload).subscribe({
      next: () => {
        this.showToast('Commissions enregistrées', 'ok');
        this.closeCommissionsModal();
        this.savingCommissions = false;
        this.loadPorteurs();
        this.loadRapport();
      },
      error: (err) => {
        console.error(err);
        this.showToast('Erreur lors de l\'enregistrement', 'err');
        this.savingCommissions = false;
      }
    });
  }

  // --- Rapport ---
  loadRapport(): void {
    if (!this.rapportPorteurId) {
      this.rapportLines = [];
      this.totaux = { totalRestaurant: 0, totalPorteur: 0, totalAvoir: 0 };
      return;
    }

    this.loadingRapport = true;
    this.porteurService.getRapport(parseInt(this.rapportPorteurId), this.rapportMois || undefined).subscribe({
      next: (data) => {
        this.rapportLines = data.lines;
        this.totaux = {
          totalRestaurant: Number(data.totaux.totalRestaurant),
          totalPorteur: Number(data.totaux.totalPorteur),
          totalAvoir: Number(data.totaux.totalAvoir)
        };
        this.currentPage = 1;
        this.loadingRapport = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.showToast('Erreur lors du chargement du rapport', 'err');
        this.loadingRapport = false;
      }
    });
  }

  // Pagination Rapport
  get totalPages(): number {
    return Math.ceil(this.rapportLines.length / this.pageSize);
  }

  get pagedRapportLines(): RapportLine[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.rapportLines.slice(start, start + this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  goToPage(n: number): void {
    if (n >= 1 && n <= this.totalPages) this.currentPage = n;
  }

  get pages(): number[] {
    const arr: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) arr.push(i);
    return arr;
  }

  // ═══════ PDF GENERATION ═══════
  private fmtNum(n: number): string {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async generateRapportPDF(): Promise<void> {
    if (!this.rapportPorteurId || this.rapportLines.length === 0) {
      this.showToast('Aucune donnée à exporter', 'err');
      return;
    }
    this.generatingPdf = true;
    this.cdr.detectChanges();

    try {
      const porteur = this.porteurs.find(p => p.id === parseInt(this.rapportPorteurId));
      if (!porteur) return;

      const jspdfModule = await import('jspdf');
      const autotableModule = await import('jspdf-autotable');
      const jsPDF = jspdfModule.default || (jspdfModule as any).jsPDF;
      const autoTable = autotableModule.default || (autotableModule as any).autoTable;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297, H = 210, ML = 6, MR = 6;

      // ── TITLE ──
      const [year, month] = (this.rapportMois || '2026-01').split('-');
      const titleMonth = `${month}-${year.slice(2)}`;
      const title = `SITUATION SOCIETE ${porteur.nom.toUpperCase()} MOIS ${titleMonth}`;

      doc.setFillColor(220, 220, 220);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(ML, 6, W - ML - MR, 10, 'FD');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(title, W / 2, 12.5, { align: 'center' });

      // ── GROUP DATA BY CLIENT ──
      const clientMap = new Map<string, RapportLine[]>();
      for (const line of this.rapportLines) {
        if (!clientMap.has(line.clientNom)) clientMap.set(line.clientNom, []);
        clientMap.get(line.clientNom)!.push(line);
      }

      let currentY = 20;
      const HEAD_COLS = ['COMMANDE N°', 'DATE', 'BL N°', 'DESIGNATION', 'QUANTITE', 'POIDS (KG)', 'Prix Restaurant', 'MONTANT', 'TOTAL FACTURE', 'Prix Franchise', 'MONTANT', 'TOTAL FACTURE', 'AVOIR'];

      const colStyles: Record<number, any> = {
        0:  { cellWidth: 16, halign: 'center' as const },
        1:  { cellWidth: 18, halign: 'center' as const },
        2:  { cellWidth: 20, halign: 'center' as const },
        3:  { cellWidth: 42 },
        4:  { cellWidth: 15, halign: 'center' as const },
        5:  { cellWidth: 16, halign: 'center' as const },
        6:  { cellWidth: 20, halign: 'right' as const },
        7:  { cellWidth: 22, halign: 'right' as const },
        8:  { cellWidth: 24, halign: 'right' as const },
        9:  { cellWidth: 20, halign: 'right' as const },
        10: { cellWidth: 22, halign: 'right' as const },
        11: { cellWidth: 24, halign: 'right' as const },
        12: { cellWidth: 24, halign: 'right' as const },
      };

      for (const [clientNom, lines] of clientMap) {
        // Check page space
        if (currentY > H - 40) {
          doc.addPage();
          currentY = 12;
        }

        // ── Client Section Header ──
        doc.setFillColor(235, 235, 235);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(ML, currentY, W - ML - MR, 7, 'FD');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(clientNom.toUpperCase(), ML + 3, currentY + 5);
        currentY += 9;

        // ── Group lines by BL ──
        const blMap = new Map<string, RapportLine[]>();
        for (const l of lines) {
          if (!blMap.has(l.blNumero)) blMap.set(l.blNumero, []);
          blMap.get(l.blNumero)!.push(l);
        }

        // ── Build rows ──
        const tableRows: any[][] = [];
        let clientSumMontantResto = 0;
        let clientSumTotalFactureResto = 0;
        let clientSumMontantPorteur = 0;
        let clientSumTotalFacturePorteur = 0;
        let clientSumAvoir = 0;
        let cmdNum = 0;

        for (const [blNum, blLines] of blMap) {
          cmdNum++;
          const blTotalResto = blLines.reduce((s, l) => s + l.montant, 0);
          const blTotalPorteur = blLines.reduce((s, l) => s + l.totalPorteur, 0);
          const blAvoir = blTotalResto - blTotalPorteur;
          const blTotalFacture = blLines[0].totalFacture;

          clientSumMontantResto += blTotalResto;
          clientSumTotalFactureResto += blTotalFacture;
          clientSumMontantPorteur += blTotalPorteur;
          clientSumTotalFacturePorteur += blTotalPorteur;
          clientSumAvoir += blAvoir;

          for (let i = 0; i < blLines.length; i++) {
            const l = blLines[i];
            const isFirst = i === 0;
            const montantPorteurLine = l.poids * l.prixPorteur;

            tableRows.push([
              isFirst ? String(cmdNum) : '',
              isFirst ? new Date(l.date).toLocaleDateString('fr-FR') : '',
              isFirst ? l.blNumero : '',
              l.produitNom,
              String(l.nbUnites || ''),
              l.poidsUnitaire ? String(l.poidsUnitaire) : String(l.poids),
              String(Math.round(l.prixRestaurant)),
              this.fmtNum(l.montant) + ' DH',
              isFirst ? this.fmtNum(blTotalFacture) + ' DH' : '',
              String(Math.round(l.prixPorteur)),
              this.fmtNum(montantPorteurLine) + ' DH',
              isFirst ? this.fmtNum(blTotalPorteur) + ' DH' : '',
              isFirst ? this.fmtNum(blAvoir) + ' DH' : '',
            ]);
          }
        }

        // Subtotal row
        tableRows.push([
          '', '', '', '', '', '', '',
          this.fmtNum(clientSumMontantResto) + ' DH',
          '', '', '',
          this.fmtNum(clientSumTotalFacturePorteur) + ' DH',
          this.fmtNum(clientSumAvoir) + ' DH',
        ]);

        const totalRowIdx = tableRows.length - 1;

        autoTable(doc, {
          startY: currentY,
          margin: { left: ML, right: MR },
          head: [HEAD_COLS],
          body: tableRows,
          theme: 'grid',
          styles: {
            fontSize: 6.5,
            cellPadding: 1.5,
            textColor: [0, 0, 0] as [number, number, number],
            lineColor: [120, 120, 120] as [number, number, number],
            lineWidth: 0.15,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: [200, 200, 200] as [number, number, number],
            textColor: [0, 0, 0] as [number, number, number],
            fontStyle: 'bold',
            fontSize: 6,
            halign: 'center' as const,
            lineColor: [80, 80, 80] as [number, number, number],
            lineWidth: 0.2,
          },
          columnStyles: colStyles,
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.row.index === totalRowIdx) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [235, 235, 235];
              data.cell.styles.fontSize = 7;
            }
          },
        });

        currentY = ((doc as any).lastAutoTable?.finalY ?? currentY + 40) + 6;
      }

      // ══ GRAND TOTALS ══
      if (currentY > H - 20) {
        doc.addPage();
        currentY = 15;
      }

      currentY += 4;
      const grandTotalResto = this.totaux.totalRestaurant;
      const grandTotalPorteur = this.totaux.totalPorteur;
      const grandTotalAvoir = this.totaux.totalAvoir;

      // Three boxes at the bottom
      const bW = 55, bH = 9;
      const gap = 15;
      const totalW = bW * 3 + gap * 2;
      const startX = (W - totalW) / 2;

      const boxes = [
        { label: this.fmtNum(grandTotalResto), x: startX },
        { label: this.fmtNum(grandTotalPorteur), x: startX + bW + gap },
        { label: this.fmtNum(grandTotalAvoir), x: startX + (bW + gap) * 2 },
      ];

      for (const box of boxes) {
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(box.x, currentY, bW, bH, 'FD');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(box.label, box.x + bW / 2, currentY + bH / 2 + 1.5, { align: 'center' });
      }

      // Output PDF
      const pdfBlob = doc.output('blob');
      if (this.pdfPreviewBlobUrl) URL.revokeObjectURL(this.pdfPreviewBlobUrl);
      this.pdfPreviewBlobUrl = URL.createObjectURL(pdfBlob);
      this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfPreviewBlobUrl);
      this.pdfPreviewName = `SITUATION_${porteur.nom.replace(/\s+/g, '_').toUpperCase()}_${this.rapportMois}.pdf`;

    } catch (err) {
      console.error('Erreur génération PDF:', err);
      this.showToast('Erreur lors de la génération du PDF', 'err');
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
}
