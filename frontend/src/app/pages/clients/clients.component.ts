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
  showModal = false;
  editMode = false;
  form: Client = { nom: '', adresse: '', telephone: '', email: '', ville: '', codepostal: '' };
  selectedClient: Client | null = null;
  deleteTarget: Client | null = null;
deleting = false;
currentPage = 1;
pageSize = 5;
  constructor(private clientsService: ClientsService,private cdr: ChangeDetectorRef) {}

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
    c.nom.toLowerCase().includes(q)
  );

  this.currentPage = 1; 
}

  openAdd(): void {
    this.editMode = false;
    this.form = { nom: '', adresse: '', telephone: '', email: '', ville: '', codepostal: '' };
    this.showModal = true;

  }

  saveClient():void {
    if (this.editMode && this.selectedClient){
      console.log('==========>Client mis à jour :');
       this.clientsService.updateClient(this.selectedClient.id!, this.form).subscribe({
      
        next: (client) => {
          const index = this.clients.findIndex(c => c.id === client.id);
          if (index !== -1) {
            this.clients[index] = client;
            this.applyFilter();
            this.showModal = false;
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
  const headers = ['ID', 'Nom', 'Adresse', 'Téléphone', 'Email', 'Ville', 'Code Postal'];
  const rows = clients.map(c => [
    c.id,
    c.nom,
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

get totalPages(): number {
  return Math.ceil(this.filteredClients.length / this.pageSize);
}

get pagedClients(): Client[] {
  const start = (this.currentPage - 1) * this.pageSize;
  return this.filteredClients.slice(start, start + this.pageSize);
}

get pages(): number[] {
  return Array.from({ length: this.totalPages }, (_, i) => i + 1);
}
goToPage(page: number): void {
  this.currentPage = page;
}
}