import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProduitService } from '../../services/produit.service';
import { ClientsService } from '../../services/clients.service';
import { PrixClientService } from '../../services/prix-client.service';
import { Produit } from '../../models/produit.model';

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './produits.component.html',
  styleUrl: './produits.component.scss'
})
export class ProduitsComponent implements OnInit {
  produits: Produit[] = [];
  filteredProduits: Produit[] = [];
  pagedProduits: Produit[] = [];
  searchQuery = '';
  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  showModal = false;
  editMode = false;
  form: Produit = { nom: '', unite: 'boule', poidsUnitaire: 1, quantite: 0, prixUnitaire: 0, tva: 0 };
  saving = false;

  deleteTarget: Produit | null = null;
  deleting = false;

  // Stock history
  historyTarget: Produit | null = null;
  mouvements: any[] = [];
  loadingHistory = false;

  unites = ['boule', 'sachet'];

  // ── Prix Clients ──
  clients: any[] = [];
  prixClients: any[] = [];
  pendingPrixClients: { clientId: number; prix: number; clientNom: string }[] = []; // pour mode ajout
  loadingPrixClients = false;
  savingPrixClient = false;
  newPrixClientId = 0;
  newPrixClientPrix: number | null = null;

  constructor(
    private produitService: ProduitService,
    private clientsService: ClientsService,
    private prixClientService: PrixClientService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.loadProduits(); }

  loadProduits(): void {
    this.loading = true;
    this.produitService.getProduits().subscribe({
      next: (data) => {
        this.produits = data.map(p => ({
          ...p,
          prixUnitaire: Number(p.prixUnitaire),
          poidsUnitaire: Number(p.poidsUnitaire),
          quantite: Number(p.quantite),
          tva: Number(p.tva || 0),
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.showMessage('Erreur de connexion', 'error'); this.cdr.detectChanges(); }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredProduits = !q ? [...this.produits] : this.produits.filter(p =>
      p.nom.toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q)
    );
    this.currentPage = 1;
    this.updatePage();
  }

  updatePage(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredProduits.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const s = (this.currentPage - 1) * this.pageSize;
    this.pagedProduits = this.filteredProduits.slice(s, s + this.pageSize);
    this.cdr.detectChanges();
  }

  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages) { this.currentPage = p; this.updatePage(); } }

  get pages(): number[] {
    const arr: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }

  // ── Computed ──
  totalKg(p: Produit): number { return p.quantite * p.poidsUnitaire; }
  valeurTotale(p: Produit): number { return p.quantite * p.poidsUnitaire * p.prixUnitaire; }

  getStockLevel(p: Produit): string {
    if (p.quantite < 5) return 'critical';
    if (p.quantite < 20) return 'warning';
    return 'healthy';
  }

  // ── Add / Edit ──
  openAdd(): void {
    this.editMode = false;
    this.form = { nom: '', unite: 'boule', poidsUnitaire: 1, quantite: 0, prixUnitaire: 0, tva: 0 };
    this.prixClients = [];
    this.pendingPrixClients = [];
    this.newPrixClientId = 0;
    this.newPrixClientPrix = null;
    this.loadClients();
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEdit(p: Produit): void {
    this.editMode = true;
    this.form = { ...p };
    this.prixClients = [];
    this.pendingPrixClients = [];
    this.newPrixClientId = 0;
    this.newPrixClientPrix = null;
    this.loadClients();
    if (p.id) this.loadPrixClients(p.id);
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.prixClients = [];
    this.pendingPrixClients = [];
    this.clients = [];
    this.newPrixClientId = 0;
    this.newPrixClientPrix = null;
    this.cdr.detectChanges();
  }

  saveProduct(): void {
    if (!this.form.nom || !this.form.prixUnitaire) return;
    this.saving = true;
    if (this.editMode && this.form.id) {
      this.produitService.updateProduit(this.form.id, this.form).subscribe({
        next: () => { this.showMessage(`"${this.form.nom}" mis à jour`, 'success'); this.closeModal(); this.saving = false; this.loadProduits(); this.cdr.detectChanges(); },
        error: () => { this.saving = false; this.showMessage('Erreur modification', 'error'); this.cdr.detectChanges(); }
      });
    } else {
      this.produitService.addProduit(this.form).subscribe({
        next: (created) => {
          // Sauvegarder les prix clients en attente
          if (this.pendingPrixClients.length > 0) {
            const saves = this.pendingPrixClients.map(pc =>
              this.prixClientService.upsert({ clientId: pc.clientId, produitId: created.id!, prix: pc.prix }).subscribe()
            );
            this.pendingPrixClients = [];
          }
          this.showMessage(`"${this.form.nom}" ajouté`, 'success');
          this.closeModal();
          this.saving = false;
          this.loadProduits();
          this.cdr.detectChanges();
        },
        error: (e) => { this.saving = false; this.showMessage(e?.error?.error || 'Erreur lors de l\'ajout', 'error'); this.cdr.detectChanges(); }
      });
    }
  }

  // ── Delete ──
  confirmDelete(p: Produit): void { this.deleteTarget = p; this.cdr.detectChanges(); }
  cancelDelete(): void { this.deleteTarget = null; this.cdr.detectChanges(); }
  executeDelete(): void {
    if (!this.deleteTarget?.id) return;
    this.deleting = true;
    this.produitService.deleteProduit(this.deleteTarget.id).subscribe({
      next: () => { this.showMessage(`"${this.deleteTarget!.nom}" supprimé`, 'success'); this.deleteTarget = null; this.deleting = false; this.loadProduits(); this.cdr.detectChanges(); },
      error: () => { this.deleting = false; this.showMessage('Erreur suppression', 'error'); this.cdr.detectChanges(); }
    });
  }

  // ── Stock History ──
  openHistory(p: Produit): void {
    this.historyTarget = p;
    this.loadingHistory = true;
    this.mouvements = [];
    this.produitService.getMouvements(p.id!).subscribe({
      next: (data) => {
        this.mouvements = data.map(m => ({
          ...m,
          ancienneQte: Number(m.ancienneQte),
          nouvelleQte: Number(m.nouvelleQte),
          delta: Number(m.delta),
        }));
        this.loadingHistory = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingHistory = false; this.cdr.detectChanges(); }
    });
  }

  closeHistory(): void { this.historyTarget = null; this.mouvements = []; this.cdr.detectChanges(); }

  // ── Excel ──
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.loading = true;
    this.produitService.importExcel(file).subscribe({
      next: (res) => { this.showMessage(`✅ ${res.message}`, 'success'); this.loadProduits(); event.target.value = ''; this.cdr.detectChanges(); },
      error: () => { this.showMessage("Erreur import", 'error'); this.loading = false; event.target.value = ''; this.cdr.detectChanges(); }
    });
  }
  triggerFileInput(): void { document.getElementById('excelUpload')?.click(); }

  private showMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg; this.messageType = type; this.cdr.detectChanges();
    setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4000);
  }

  // ══════════════════════════════════════════
  // PRIX SPÉCIFIQUES PAR CLIENT
  // ══════════════════════════════════════════

  loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (data: any[]) => { this.clients = data; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  loadPrixClients(produitId: number): void {
    this.loadingPrixClients = true;
    this.prixClientService.getByProduit(produitId).subscribe({
      next: (data: any[]) => {
        this.prixClients = data.map((pc: any) => ({ ...pc, prix: Number(pc.prix) }));
        this.loadingPrixClients = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPrixClients = false; this.cdr.detectChanges(); }
    });
  }

  addPrixClient(): void {
    if (!this.newPrixClientId || !this.newPrixClientPrix || Number(this.newPrixClientPrix) <= 0) return;

    // Mode AJOUT : mettre en file d'attente (pas encore d'ID produit)
    if (!this.editMode || !this.form.id) {
      const client = this.clients.find(c => c.id === Number(this.newPrixClientId));
      this.pendingPrixClients.push({
        clientId: Number(this.newPrixClientId),
        prix: Number(this.newPrixClientPrix),
        clientNom: client?.nom || `Client #${this.newPrixClientId}`
      });
      this.newPrixClientId = 0;
      this.newPrixClientPrix = null;
      this.showMessage('Prix client ajouté — sera sauvegardé avec le produit', 'success');
      this.cdr.detectChanges();
      return;
    }

    // Mode MODIFICATION : sauvegarder directement
    this.savingPrixClient = true;
    this.prixClientService.upsert({
      clientId: Number(this.newPrixClientId),
      produitId: this.form.id,
      prix: Number(this.newPrixClientPrix)
    }).subscribe({
      next: (data: any) => {
        this.savingPrixClient = false;
        this.newPrixClientId = 0;
        this.newPrixClientPrix = null;
        this.loadPrixClients(this.form.id!);
        this.showMessage(`Prix spécifique ajouté pour ${data.client?.nom}`, 'success');
      },
      error: () => {
        this.savingPrixClient = false;
        this.showMessage('Erreur lors de l\'ajout du prix', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  deletePrixClient(id: number): void {
    this.prixClientService.delete(id).subscribe({
      next: () => {
        this.prixClients = this.prixClients.filter((pc: any) => pc.id !== id);
        this.showMessage('Prix spécifique supprimé', 'success');
        this.cdr.detectChanges();
      },
      error: () => { this.showMessage('Erreur suppression', 'error'); this.cdr.detectChanges(); }
    });
  }

  deletePendingPrixClient(index: number): void {
    this.pendingPrixClients.splice(index, 1);
    this.cdr.detectChanges();
  }

  getAvailableClients(): any[] {
    const usedIds = new Set(this.prixClients.map((pc: any) => pc.clientId));
    return this.clients.filter(c => !usedIds.has(c.id));
  }

  /** Pour le dropdown en mode ajout : exclut les clients déjà dans pendingPrixClients */
  getAvailableClientsAll(): any[] {
    if (this.editMode) {
      return this.getAvailableClients();
    }
    const usedIds = new Set(this.pendingPrixClients.map(pc => pc.clientId));
    return this.clients.filter(c => !usedIds.has(c.id));
  }
}
