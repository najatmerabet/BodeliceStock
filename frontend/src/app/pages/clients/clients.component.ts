import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ClientsService } from '../../services/clients.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client } from '../../models/clients.model';
import { ClientFichiersService } from '../../services/client-file.service';
import { ClientFile } from '../../models/client-file.model';
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
showFichiersModal = false;
clientFichiers: ClientFile[] = [];
fichiersClient: Client | null = null;
loadingFichiers = false;
uploadingFichier = false;
deletingFichier = false;
fichierDeleteTarget: ClientFile | null = null;
showFichierEditModal = false;
fichierEditForm: Partial<ClientFile> = {};
fichierEditTarget: ClientFile | null = null;
isDragging = false;
// ── Nouveaux fichiers en attente (avant création du client) ──
pendingFiles: { file: File; nom: string; type: string; remarque: string }[] = [];
uploadingPending = false;
pendingClientFiles: {
  file: File;
  type: string;
  remarque: string;
}[] = [];
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

  constructor(private clientsService: ClientsService, private cdr: ChangeDetectorRef, private clientFichiersService: ClientFichiersService) {}

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
  this.pendingFiles = []; // ← reset des fichiers en attente
  this.showModal = true;
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

      return this.clientFichiersService
        .uploadFichier(client.id!, fd)
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

// Ouvrir le modal fichiers d'un client
openFichiers(client: Client): void {
  this.fichiersClient = client;
  this.showFichiersModal = true;
  this.loadFichiers();
}

closeFichiersModal(): void {
  this.showFichiersModal = false;
  this.clientFichiers = [];
  this.fichiersClient = null;
}

loadFichiers(): void {
  if (!this.fichiersClient?.id) return;
  this.loadingFichiers = true;
  this.clientFichiersService.getFichiers(this.fichiersClient.id).subscribe({
    next: (data) => { this.clientFichiers = data; this.loadingFichiers = false; this.cdr.detectChanges(); },
    error: () => { this.loadingFichiers = false; }
  });
}

onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length || !this.fichiersClient?.id) return;

  const file = input.files[0];
  const fd = new FormData();
  fd.append('fichier', file);
  fd.append('nom', file.name);
  fd.append('type', 'AUTRE');

  this.uploadingFichier = true;
  this.clientFichiersService.uploadFichier(this.fichiersClient.id, fd).subscribe({
    next: (f) => {
      this.clientFichiers.unshift(f);
      this.uploadingFichier = false;
      this.showToast('Fichier ajouté', 'ok');
      this.cdr.detectChanges();
    },
    error: () => {
      this.uploadingFichier = false;
      this.showToast('Erreur upload', 'err');
    }
  });
  input.value = '';
}

openFichierEdit(f: ClientFile): void {
  this.fichierEditTarget = f;
  this.fichierEditForm = { nom: f.nom, type: f.type, remarque: f.remarque };
  this.showFichierEditModal = true;
}

saveFichierEdit(): void {
  if (!this.fichierEditTarget || !this.fichiersClient?.id) return;
  this.clientFichiersService.updateFichier(
    this.fichiersClient.id, this.fichierEditTarget.id!, this.fichierEditForm
  ).subscribe({
    next: (updated) => {
      const i = this.clientFichiers.findIndex(f => f.id === updated.id);
      if (i !== -1) this.clientFichiers[i] = updated;
      this.showFichierEditModal = false;
      this.showToast('Fichier modifié', 'ok');
      this.cdr.detectChanges();
    },
    error: () => this.showToast('Erreur modification', 'err')
  });
}


confirmDeleteFichier(f: ClientFile): void {
  this.fichierDeleteTarget = f;
}

executeDeleteFichier(): void {
  if (!this.fichierDeleteTarget || !this.fichiersClient?.id) return;
  this.deletingFichier = true;
  this.clientFichiersService.deleteFichier(this.fichiersClient.id, this.fichierDeleteTarget.id!).subscribe({
    next: () => {
      this.clientFichiers = this.clientFichiers.filter(f => f.id !== this.fichierDeleteTarget!.id);
      this.fichierDeleteTarget = null;
      this.deletingFichier = false;
      this.showToast('Fichier supprimé', 'ok');
      this.cdr.detectChanges();
    },
    error: () => { this.deletingFichier = false; this.showToast('Erreur suppression', 'err'); }
  });
}

downloadFichier(f: ClientFile): void {
  if (!this.fichiersClient?.id) return;
  window.open(this.clientFichiersService.getDownloadUrl(this.fichiersClient.id, f.id!), '_blank');
}

getFileIcon(type: string): string {
  const icons: Record<string, string> = {
    CONTRAT: 'description', CIN: 'badge', RC: 'business', AUTRE: 'attach_file'
  };
  return icons[type] || 'attach_file';
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

}