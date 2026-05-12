import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ClientsService } from '../../services/clients.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client } from '../../models/clients.model';
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
  form: Client = { nom: '',ice: '' ,adresse: '', telephone: '', email: '', ville: '', codepostal: '' };
  selectedClient: Client | null = null;
  deleteTarget: Client | null = null;
  deleting = false;

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

  constructor(private clientsService: ClientsService, private cdr: ChangeDetectorRef) {}

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

  this.filteredClients = this.clients.filter(c =>
    c.nom.toLowerCase().includes(q) ||
    (c.telephone || '').toLowerCase().includes(q) ||
    (c.adresse || '').toLowerCase().includes(q) ||
    (c.ville || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  );
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
    this.form = { nom: '', ice: '', adresse: '', telephone: '', email: '', ville: '', codepostal: '' };
    this.showModal = true;

  }

  saveClient():void {
    if (this.editMode && this.selectedClient){
      console.log('==========>Client mis à jour :',this.form);
       this.clientsService.updateClient(this.selectedClient.id!, this.form).subscribe({
      
next: (client) => {
          const index = this.clients.findIndex(c => c.id === client.id);
          if (index !== -1) {
            this.clients[index] = client;
            this.applyFilter();
            this.showModal = false;
            this.showToast('Client modifié avec succès', 'ok');
            this.cdr.detectChanges();
          }
           console.log('==========>Client mis à jour :', client);
         },
        error: (err) => console.error('Erreur:', err)
      });
      return;
    }else {
      console.log('==========>Nouveau client ajouté :');
    this.clientsService.addClient(this.form).subscribe({
      next: (client) => {
        this.clients.push(client);
        this.applyFilter();
        this.showModal = false;
        this.showToast('Client ajouté avec succès', 'ok');
        this.cdr.detectChanges();
      },
      
      error: (err) => console.error('Erreur:', err)
     
    });
  }
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
}