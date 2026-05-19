import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientFilesService } from '../../services/client-files.service';
import { ClientFoldersService } from '../../services/client-folders.service';
import { Client } from '../../models/clients.model';
import { ClientFileItem, ClientFolder } from '../../models/client-file.model';
import { FileManagerComponent } from '../file-manager/file-manager.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, FileManagerComponent],
  template: `
    <div class="client-detail">
      <!-- Header avec client info -->
      <div class="detail-header" [style.borderLeftColor]="clientColor">
        <div class="client-avatar">
          {{ client.nom.charAt(0).toUpperCase() || 'C' }}
        </div>
        <div class="client-main-info">
          <h2>{{ client.nom }}</h2>
          <div class="client-tags">
            <span class="tag tag-ref">{{ client.reference || 'Sans réf.' }}</span>
            <span class="tag" *ngIf="client.ville">{{ client.ville }}</span>
            <span class="tag tag-ice" *ngIf="client.ice">ICE: {{ client.ice }}</span>
          </div>
        </div>
        <button class="close-btn" (click)="close.emit()">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <!-- Tabs Navigation -->
      <div class="detail-tabs">
        <button class="tab-btn" [class.active]="activeTab === 'info'" (click)="activeTab = 'info'">
          <span class="material-symbols-rounded">info</span>
          Informations
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'files'" (click)="activeTab = 'files'">
          <span class="material-symbols-rounded">folder</span>
          Fichiers
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-content">
        <!-- Tab: Informations -->
        <div *ngIf="activeTab === 'info'" class="tab-pane">
          <div class="info-grid">
            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">person</span>
              </div>
              <div class="info-content">
                <label>Nom</label>
                <span class="value">{{ client.nom }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">badge</span>
              </div>
              <div class="info-content">
                <label>Référence</label>
                <span class="value mono">{{ client.reference || '-' }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">fingerprint</span>
              </div>
              <div class="info-content">
                <label>ICE</label>
                <span class="value mono">{{ client.ice || '-' }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">mail</span>
              </div>
              <div class="info-content">
                <label>Email</label>
                <span class="value">{{ client.email || '-' }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">phone</span>
              </div>
              <div class="info-content">
                <label>Téléphone</label>
                <span class="value mono">{{ client.telephone || '-' }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">location_on</span>
              </div>
              <div class="info-content">
                <label>Adresse</label>
                <span class="value">{{ client.adresse || '-' }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">location_city</span>
              </div>
              <div class="info-content">
                <label>Ville</label>
                <span class="value">{{ client.ville || '-' }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-icon">
                <span class="material-symbols-rounded">markunread_mailbox</span>
              </div>
              <div class="info-content">
                <label>Code Postal</label>
                <span class="value mono">{{ client.codepostal || '-' }}</span>
              </div>
            </div>
          </div>

          <!-- Actions rapide -->
          <div class="quick-actions">
            <button class="action-btn" (click)="editClient()">
              <span class="material-symbols-rounded">edit</span>
              Modifier
            </button>
            <button class="action-btn" (click)="activeTab = 'files'">
              <span class="material-symbols-rounded">folder_open</span>
              Gérer les fichiers
            </button>
          </div>
        </div>

        <!-- Tab: Fichiers (File Manager) -->
        <div *ngIf="activeTab === 'files'" class="tab-pane">
          <app-file-manager [client]="client"></app-file-manager>
        </div>
      </div>

      <!-- Edit Modal -->
      <div class="modal-overlay" *ngIf="showEditModal" (click)="showEditModal = false">
        <div class="modal-box modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Modifier le client</h3>
            <button class="modal-close" (click)="showEditModal = false">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group">
                <label>Nom *</label>
                <input type="text" [(ngModel)]="editForm.nom" class="form-input">
              </div>
              <div class="form-group">
                <label>Référence</label>
                <input type="text" [(ngModel)]="editForm.reference" class="form-input">
              </div>
              <div class="form-group">
                <label>ICE</label>
                <input type="text" [(ngModel)]="editForm.ice" class="form-input">
              </div>
              <div class="form-group">
                <label>Téléphone</label>
                <input type="text" [(ngModel)]="editForm.telephone" class="form-input">
              </div>
              <div class="form-group full">
                <label>Adresse</label>
                <input type="text" [(ngModel)]="editForm.adresse" class="form-input">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" [(ngModel)]="editForm.email" class="form-input">
              </div>
              <div class="form-group">
                <label>Ville</label>
                <input type="text" [(ngModel)]="editForm.ville" class="form-input">
              </div>
              <div class="form-group">
                <label>Code Postal</label>
                <input type="text" [(ngModel)]="editForm.codepostal" class="form-input">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showEditModal = false">Annuler</button>
            <button class="btn-primary" (click)="saveClient()">
              <span class="material-symbols-rounded">save</span>
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div *ngIf="toast" class="toast" [class.toast-ok]="toastType === 'ok'" [class.toast-err]="toastType === 'err'">
        <span class="material-symbols-rounded">{{ toastType === 'ok' ? 'check_circle' : 'error' }}</span>
        {{ toast }}
      </div>
    </div>
  `,
  styles: [`
    .client-detail {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
      border-left: 4px solid #059669;
      border-bottom: 1px solid #E2E8F0;
    }

    .client-avatar {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #fff;
      font-size: 1.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .client-main-info {
      flex: 1;
    }

    .client-main-info h2 {
      margin: 0 0 8px;
      font-size: 1.4rem;
      color: #1E293B;
    }

    .client-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tag {
      padding: 4px 10px;
      background: #E2E8F0;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #475569;
    }

    .tag-ref {
      background: #DBEAFE;
      color: #2563EB;
    }

    .tag-ice {
      background: #FEF3C7;
      color: #D97706;
    }

    .close-btn {
      padding: 8px;
      border: none;
      background: none;
      border-radius: 8px;
      cursor: pointer;
      color: #64748B;
    }

    .close-btn:hover {
      background: #E2E8F0;
      color: #1E293B;
    }

    .detail-tabs {
      display: flex;
      gap: 4px;
      padding: 0 24px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 20px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #64748B;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: #1E293B;
    }

    .tab-btn.active {
      color: #059669;
      border-bottom-color: #059669;
    }

    .detail-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .info-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px;
      background: #F8FAFC;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
    }

    .info-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #059669;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .info-content {
      flex: 1;
    }

    .info-content label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #94A3B8;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .info-content .value {
      font-size: 0.95rem;
      color: #1E293B;
      font-weight: 500;
    }

    .info-content .mono {
      font-family: 'SF Mono', monospace;
    }

    .quick-actions {
      display: flex;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: 1px solid #E2E8F0;
      background: #fff;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #475569;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal-box {
      background: #fff;
      border-radius: 16px;
      width: 100%;
      max-width: 540px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #E2E8F0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .modal-close {
      padding: 4px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 6px;
    }

    .modal-close:hover { background: #F1F5F9; }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group.full {
      grid-column: span 2;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
    }

    .form-input {
      padding: 10px 14px;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .form-input:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid #E2E8F0;
    }

    .btn-primary, .btn-secondary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .btn-primary {
      background: #059669;
      color: #fff;
    }

    .btn-primary:hover { background: #047857; }

    .btn-secondary {
      background: #F1F5F9;
      color: #475569;
    }

    .btn-secondary:hover { background: #E2E8F0; }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 500;
      z-index: 200;
      animation: slideIn 0.3s ease;
    }

    .toast-ok { background: #059669; color: #fff; }
    .toast-err { background: #DC2626; color: #fff; }

    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class ClientDetailComponent implements OnInit {
  @Input() client!: Client;
  @Output() close = new EventEmitter<void>();
  @Output() clientUpdated = new EventEmitter<Client>();

  activeTab: 'info' | 'files' = 'info';
  showEditModal = false;
  editForm: Partial<Client> = {};
  toast = '';
  toastType: 'ok' | 'err' = 'ok';

  clientColors = ['#059669', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2'];

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  }

  get clientColor(): string {
    return this.getClientColor();
  }

  getClientColor(): string {
    if (!this.client?.nom) return '#059669';
    const colors = ['#059669', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2'];
    const index = this.client.nom.charCodeAt(0) % colors.length;
    return colors[index];
  }

  editClient(): void {
    this.editForm = { ...this.client };
    this.showEditModal = true;
  }

  saveClient(): void {
    this.clientUpdated.emit(this.editForm as Client);
    this.showEditModal = false;
    this.showToast('Client modifié', 'ok');
  }

  showToast(msg: string, type: 'ok' | 'err'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => { this.toast = ''; this.cdr.detectChanges(); }, 3000);
    this.cdr.detectChanges();
  }
}