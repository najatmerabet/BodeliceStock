import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ClientsService } from '../../services/clients.service';
import { FactureService } from '../../services/facture.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Client } from '../../models/clients.model';
import { ClientFilesService } from '../../services/client-files.service';
import { ClientFileItem } from '../../models/client-file.model';
import { HttpClientModule } from '@angular/common/http';
@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  searchQuery = '';
  message = '';
  messageType: 'success' | 'error' = 'success';
  toast = '';
  toastType: 'ok' | 'err' = 'ok';
  showModal = false;
editMode = false;
  form: Client = { nom: '', ice: '', reference: '', adresse: '', telephone: '', email: '', ville: '', codepostal: '' };
  selectedClient: Client | null = null;
  deleteTarget: Client | null = null;
  deleting = false;
  sortColumn: 'nom' | 'ville' | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  filterNom: string = '';
  filterVille: string = '';
  showDetailModal = false;
  detailClient: Client | null = null;

  isDragging = false;
// ── Nouveaux fichiers en attente (avant création du client) ──
pendingFiles: { file: File; nom: string; type: string; remarque: string }[] = [];
uploadingPending = false;
pendingClientFiles: {
  file: File;
  type: string;
  remarque: string;
}[] = [];

  // Relevé de Compte
  showReleveModal = false;
  releveClient: Client | null = null;
  releveDateFrom = '';
  releveDateTo = '';
  generatingReleve = false;
  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfPreviewBlobUrl: string | null = null;
  pdfPreviewName = '';

  // Pagination
  pageSize = 10;
  currentPage = 1;
  get totalPages(): number { return Math.ceil(this.filteredClients.length / this.pageSize); }
  get pagedClients(): Client[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredClients.slice(start, start + this.pageSize);
  }
  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  goToPage(n: number): void { if (n >= 1 && n <= this.totalPages) this.currentPage = n; }
  get pages(): number[] {
    const arr: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) arr.push(i);
    return arr;
  }

  
  readonly VILLES_MAROC = [
    'Tanger','Tétouan','Al Hoceima','Larache','Asilah','Chefchaouen','Fnideq','Martil',
    'Casablanca','Mohammadia','El Jadida','Settat','Berrechid','Benslimane',
    'Rabat','Salé','Témara','Kénitra','Khémisset','Skhirat',
    'Fès','Meknès','Ifrane','Khenifra','Azrou','El Hajeb',
    'Marrakech','Agadir','Essaouira','Safi','El Kelaâ des Sraghna','Youssoufia',
    'Oujda','Nador','Berkane','Taourirt','Jerada','Driouch',
    'Béni Mellal','Khouribga','Fquih Ben Salah','Azilal','Kasba Tadla',
    'Laâyoune','Dakhla','Boujdour','Smara',
    'Errachidia','Ouarzazate','Zagora','Tinghir','Midelt',
    'Guelmim','Tiznit','Taroudant','Chtouka Aït Baha',
    'Taza','Guercif','Sefrou','Boulmane',
    'Khénifra','Azilal',
  ];

  villeQuery = '';

  get villesSuggestions(): string[] {
    const q = (this.form.ville || '').toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return this.VILLES_MAROC.filter(v => v.toLowerCase().includes(q)).slice(0, 8);
  }

  selectVille(v: string): void {
    this.form.ville = v;
    this.villeQuery = '';
    this.cdr.markForCheck();
  }

  constructor(
    private clientsService: ClientsService,
    private factureService: FactureService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private clientFilesService: ClientFilesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (data) => {
        this.clients = data;
        this.cdr.detectChanges();
        this.filteredClients = data;
        this.cdr.detectChanges();
        this.searchQuery = '';
        console.log('Clients chargés :', this.clients);
      },
      error: (err) => console.error('Erreur:', err)
    });
  }

applyFilter(): void {
  const q = this.searchQuery.toLowerCase();

  let result = this.clients.filter(c => {
    const matchSearch =
      c.nom.toLowerCase().includes(q) ||
      (c.telephone || '').toLowerCase().includes(q) ||
      (c.adresse || '').toLowerCase().includes(q) ||
      (c.ville || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q);

    const matchNom = this.filterNom
      ? c.nom.toLowerCase().startsWith(this.filterNom.toLowerCase())
      : true;

    const matchVille = this.filterVille
      ? (c.ville || '').toLowerCase().startsWith(this.filterVille.toLowerCase())
      : true;

    return matchSearch && matchNom && matchVille;
  });

  if (this.sortColumn) {
    result = result.sort((a, b) => {
      const valA = (a[this.sortColumn!] || '').toLowerCase();
      const valB = (b[this.sortColumn!] || '').toLowerCase();
      const cmp = valA.localeCompare(valB, 'fr');
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  this.filteredClients = result;
  this.currentPage = 1;
}

getUniqueCities(): number {
  const cities = new Set(this.clients.filter(c => c.ville).map(c => c.ville));
  return cities.size;
}

getUniqueVilles(): number {
  const villes = new Set(this.clients.filter(c => c.ville).map(c => c.ville));
  return villes.size;
}

private showToast(msg: string, type: 'ok' | 'err'): void {
  this.toast = msg;
  this.toastType = type;
  setTimeout(() => { this.toast = ''; this.cdr.detectChanges(); }, 3500);
}

private showMessage(msg: string, type: 'success' | 'error'): void {
  this.message = msg;
  this.messageType = type;
  setTimeout(() => { this.message = ''; this.cdr.detectChanges(); }, 4500);
}

  openAdd(): void {
  this.editMode = false;
  this.form = { nom: '', ice: '', reference: '', adresse: '', telephone: '', email: '', ville: '', codepostal: '' };
  this.pendingFiles = [];
  this.showModal = true;
}

openDetail(client: Client): void {
  this.router.navigate(['/clients', client.id]);
}

closeDetailModal(): void {
  this.showDetailModal = false;
  this.detailClient = null;
}

onClientUpdated(client: Client): void {
  this.clientsService.updateClient(client.id!, client).subscribe({
    next: (updated) => {
      const index = this.clients.findIndex(c => c.id === updated.id);
      if (index !== -1) this.clients[index] = updated;
      this.detailClient = updated;
      this.cdr.detectChanges();
    },
    error: (err) => console.error('Update error:', err)
  });
}

saveClient(): void {
  if (this.editMode && this.selectedClient) {
    // ── Mode ÉDITION (inchangé) ──
    this.clientsService.updateClient(this.selectedClient.id!, this.form).subscribe({
      next: (client) => {
        const index = this.clients.findIndex(c => c.id === client.id);
        if (index !== -1) this.clients[index] = client;
        this.applyFilter();
        this.showModal = false;
        this.showToast('Client modifié avec succès', 'ok');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast(err?.error?.error || err?.message || 'Erreur', 'err');
        this.cdr.detectChanges();
      }
    });
    return;
  }

  // ── Mode CRÉATION ──
  const payload: any = { nom: this.form.nom };
  if (this.form.ice)        payload.ice        = this.form.ice;
  if (this.form.adresse)    payload.adresse    = this.form.adresse;
  if (this.form.telephone)  payload.telephone  = this.form.telephone;
  if (this.form.email)      payload.email      = this.form.email;
  if (this.form.ville)      payload.ville      = this.form.ville;
  if (this.form.codepostal) payload.codepostal = this.form.codepostal;

this.clientsService.addClient(payload).subscribe({
  next: (client) => {

    this.clients.push(client);
    this.applyFilter();
    this.showModal = false;
    this.cdr.detectChanges();

    if (this.pendingClientFiles.length === 0) {
      this.showToast('Client ajouté', 'ok');
      return;
    }

    // ✅ Upload séquentiel avec l'ID reçu du serveur
    const uploads = this.pendingClientFiles.map(pf => {
      const fd = new FormData();
      fd.append('fichier', pf.file, pf.file.name); // ← nom explicite
      fd.append('nom', pf.file.name);
      fd.append('type', pf.type);
      fd.append('remarque', pf.remarque ?? '');

      console.log('Upload fichier pour client ID:', client.id, pf.file.name);

      return this.clientFilesService
        .uploadFile(client.id!, fd)
        .toPromise();
    });

    Promise.allSettled(uploads).then((results) => {
      const errors = results.filter(r => r.status === 'rejected');
      if (errors.length > 0) {
        console.error('Erreurs upload:', errors);
        this.showToast(`Client ajouté mais ${errors.length} fichier(s) échoué(s)`, 'err');
      } else {
        this.showToast('Client + fichiers ajoutés avec succès', 'ok');
      }
      this.pendingClientFiles = [];
      this.cdr.detectChanges();
    });
  },
  error: () => {
    this.showToast('Erreur création client', 'err');
  }
});
}
  
  closeModal(): void {
    this.showModal = false;
   }

  openEdit(client: Client): void {
      this.editMode = true;
      this.selectedClient = client;
      this.form = { ...client };
      this.showModal = true;
  }

onDrop(event: DragEvent): void {
  event.preventDefault();
  this.isDragging = false;
  const files = Array.from(event.dataTransfer?.files || []);
  files.forEach(file => this.pendingClientFiles.push({ file, type: 'AUTRE', remarque: '' }));
}
// Ajouter un fichier à la liste en attente (pas d'upload encore)
onPendingFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  Array.from(input.files).forEach(file => {
    this.pendingFiles.push({ file, nom: file.name, type: 'AUTRE', remarque: '' });
  });
  input.value = '';
}

removePendingFile(index: number): void {
  this.pendingFiles.splice(index, 1);
}
executeDelete(): void {
  if (!this.deleteTarget) return;

  this.deleting = true;

  this.clientsService.deleteClient(this.deleteTarget.id!).subscribe({
    next: () => {
      this.clients = this.clients.filter(c => c.id !== this.deleteTarget!.id);
      this.applyFilter();
      this.showToast('Client supprimé', 'ok');
      this.cdr.detectChanges();
      
      setTimeout(() => {
        this.deleting = false;
        this.deleteTarget = null;
        this.cdr.detectChanges();
      });
    },
    error: (err) => {
      console.error(err);

      setTimeout(() => {
        this.deleting = false;
        this.cdr.detectChanges();
      });
    }
  });
}

readonly TYPES = ['CONTRAT', 'CIN', 'RC', 'AUTRE'];


  // Ouvrir le gestionnaire de fichiers moderne
  openFichiers(client: Client): void {
    this.router.navigate(['/clients', client.id], { queryParams: { tab: 'files' } });
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  cancelDelete(): void {
    setTimeout(() => {
      this.deleteTarget = null;
    });
  }
deleteClient(client: Client): void {
  this.deleteTarget = client;
}

exceltexportclients(clients: Client[]): void {
  const headers = ['ID', 'Nom', 'ICE', 'Adresse', 'Téléphone', 'Email', 'Ville', 'Code Postal'];
  const rows = clients.map(c => [
    c.id,
    c.nom,
    c.ice,
    c.adresse,
    c.telephone,
    c.email || '',
    c.ville || '',
    c.codepostal || ''
  ]);

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'clients.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

sortBy(column: 'nom' | 'ville'): void {
  if (this.sortColumn === column) {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    this.sortColumn = column;
    this.sortDirection = 'asc';
  }
  this.applyFilter();
}
onClientFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  Array.from(input.files).forEach(file => {
    this.pendingClientFiles.push({
      file,
      type: 'AUTRE',
      remarque: ''
    });
  });

  input.value = '';
}
removeClientFile(index: number): void {
  this.pendingClientFiles.splice(index, 1);
}

// ── RELEVÉ DE COMPTE ──
openReleveModal(client: Client): void {
  this.releveClient = client;
  this.showReleveModal = true;
  // Dates vides par défaut = afficher tout
  this.releveDateFrom = '';
  this.releveDateTo = '';
  this.cdr.detectChanges();
}

closeReleveModal(): void {
  this.showReleveModal = false;
  this.releveClient = null;
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
  if (!this.releveClient) return;
  this.generatingReleve = true;

  try {
    const data: any = await new Promise((resolve, reject) => {
      this.factureService.getReleveClient(
        this.releveClient!.id!,
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
        // Colonne Statut (index 4)
        if (cellData.section === 'body' && cellData.column.index === 4) {
          const val = cellData.cell.text[0];
          if (val === 'PAYÉE') { cellData.cell.styles.textColor = GREEN; cellData.cell.styles.fontStyle = 'bold'; }
          else if (val === 'PARTIELLE') { cellData.cell.styles.textColor = ORANGE; cellData.cell.styles.fontStyle = 'bold'; }
          else { cellData.cell.styles.textColor = RED; cellData.cell.styles.fontStyle = 'bold'; }
        }
        // Colonne Reste (index 7) : rouge seulement si > 0
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
}