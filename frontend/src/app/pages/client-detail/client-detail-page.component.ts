import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientsService } from '../../services/clients.service';
import { Client } from '../../models/clients.model';
import { ClientFilesPageComponent } from '../client-files/client-files-page.component';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientFilesPageComponent],
  templateUrl: './client-detail-page.component.html',
  styleUrls: ['./client-detail-page.component.scss']
})
export class ClientDetailPageComponent implements OnInit {
  client!: Client;
  activeTab: 'info' | 'files' = 'info';
  editMode = false;
  editForm: any = {};
  loading = true;
  saving = false;
  toast = '';
  toastType: 'ok' | 'err' = 'ok';

  get infoItems() {
    return [
      { icon: 'person', label: 'Nom', value: this.client?.nom || '-', color: '#059669' },
      { icon: 'badge', label: 'Référence', value: this.client?.reference || '-', color: '#2563EB' },
      { icon: 'fingerprint', label: 'ICE', value: this.client?.ice || '-', color: '#7C3AED' },
      { icon: 'mail', label: 'Email', value: this.client?.email || '-', color: '#DC2626' },
      { icon: 'phone', label: 'Téléphone', value: this.client?.telephone || '-', color: '#0891B2' },
      { icon: 'location_on', label: 'Adresse', value: this.client?.adresse || '-', color: '#EA580C' },
      { icon: 'location_city', label: 'Ville', value: this.client?.ville || '-', color: '#16A34A' },
      { icon: 'markunread_mailbox', label: 'Code Postal', value: this.client?.codepostal || '-', color: '#DB2777' },
    ];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientsService: ClientsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const clientId = this.route.snapshot.paramMap.get('id');
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'files' || tabParam === 'info') {
      this.activeTab = tabParam;
    }

    if (clientId) {
      this.clientsService.getClient(+clientId).subscribe({
        next: (client) => {
          this.client = client;
          this.editForm = { ...client };
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/clients']);
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/clients']);
  }

  toggleEdit(): void {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.editForm = { ...this.client };
    }
  }

  cancelEdit(): void {
    this.editMode = false;
    this.editForm = { ...this.client };
  }

  saveClient(): void {
    this.saving = true;
    this.clientsService.updateClient(this.client.id!, this.editForm).subscribe({
      next: (updated) => {
        this.client = updated;
        this.editMode = false;
        this.saving = false;
        this.showToast('Client modifié avec succès', 'ok');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.showToast('Erreur lors de la modification', 'err');
        console.error('Update error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  showToast(msg: string, type: 'ok' | 'err'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => { this.toast = ''; this.cdr.detectChanges(); }, 3500);
    this.cdr.detectChanges();
  }
}