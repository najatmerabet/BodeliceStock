import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientFilesService } from '../../services/client-files.service';
import { ClientFoldersService } from '../../services/client-folders.service';
import { Client } from '../../models/clients.model';
import { ClientFileItem, ClientFolder } from '../../models/client-file.model';

@Component({
  selector: 'app-client-files-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fm-container">
      <!-- Header -->
      <div class="fm-header">
        <div class="fm-breadcrumb">
          <button class="crumb-btn" (click)="navigateToFolder(null)">
            <span class="material-symbols-rounded">home</span>
            <span>Fichiers</span>
          </button>
          <ng-container *ngFor="let crumb of breadcrumb; let last = last">
            <span class="material-symbols-rounded">chevron_right</span>
            <button class="crumb-btn" [class.active]="last" (click)="navigateToFolder(crumb.id!)">
              {{ crumb.nom }}
            </button>
          </ng-container>
        </div>
        <div class="fm-actions">
          <button class="action-btn" (click)="showNewFolderModal = true">
            <span class="material-symbols-rounded">create_new_folder</span>
            <span>Nouveau dossier</span>
          </button>
          <button class="action-btn upload" (click)="triggerFileInput()">
            <span class="material-symbols-rounded">upload</span>
            <span>Ajouter fichier</span>
          </button>
          <input #fileInput type="file" multiple hidden (change)="onFilesSelected($event)">
        </div>
      </div>

      <!-- Content -->
      <div class="fm-content" 
           (dragover)="onDragOver($event)" 
           (drop)="onDrop($event)" 
           [class.drag-active]="isDragging">
        
        <div class="drop-overlay" *ngIf="isDragging">
          <div class="drop-icon">
            <span class="material-symbols-rounded">upload_file</span>
          </div>
          <p>Déposez vos fichiers ici</p>
        </div>

        <div class="loading-state" *ngIf="loading">
          <div class="spinner"></div>
          <p>Chargement...</p>
        </div>

        <div class="empty-state" *ngIf="!loading && folders.length === 0 && files.length === 0">
          <div class="empty-icon">
            <span class="material-symbols-rounded">folder_open</span>
          </div>
          <p>Dossier vide</p>
          <span>Glissez-déposez des fichiers ou cliquez sur 'Ajouter fichier'</span>
        </div>

        <!-- Folders -->
        <div class="section" *ngIf="folders.length > 0">
          <div class="section-header">
            <span class="material-symbols-rounded">folder</span>
            <h3>Dossiers</h3>
            <span class="count">{{ folders.length }}</span>
          </div>
          <div class="folders-grid">
            <div class="folder-card" *ngFor="let folder of folders" (click)="openFolder(folder)">
              <div class="folder-icon-pro" [style.color]="folder.couleur || '#6366F1'">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10C4 7.79 5.79 6 8 6H18L22 10H40C42.21 10 44 11.79 44 14V38C44 40.21 42.21 42 40 42H8C5.79 42 4 40.21 4 38V10Z" [attr.fill]="folder.couleur || '#6366F1'" fill-opacity="0.15"/>
                  <path d="M4 14C4 11.79 5.79 10 8 10H40C42.21 10 44 11.79 44 14V38C44 40.21 42.21 42 40 42H8C5.79 42 4 40.21 4 38V14Z" [attr.fill]="folder.couleur || '#6366F1'" fill-opacity="0.3"/>
                </svg>
              </div>
              <span class="folder-name">{{ folder.nom }}</span>
              <button class="folder-more" (click)="$event.stopPropagation(); showFolderMenu(folder, $event)">
                <span class="material-symbols-rounded">more_horiz</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Files -->
        <div class="section" *ngIf="files.length > 0">
          <div class="section-header">
            <span class="material-symbols-rounded">description</span>
            <h3>Fichiers</h3>
            <span class="count">{{ files.length }}</span>
          </div>
          <div class="files-grid">
            <div class="file-card" *ngFor="let file of files">
              <div class="file-icon-pro" [class]="getFileIconClass(file.nom)">
                <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4C4 1.79 5.79 0 8 0H26L40 14V44C40 46.21 38.21 48 36 48H8C5.79 48 4 46.21 4 44V4Z" fill="currentColor" fill-opacity="0.12"/>
                  <path d="M26 0L40 14H30C27.79 14 26 12.21 26 10V0Z" fill="currentColor" fill-opacity="0.25"/>
                </svg>
                <span class="fip-ext">{{ getFileExtLabel(file.nom) }}</span>
              </div>
              <div class="file-details">
                <span class="file-name">{{ file.nom }}</span>
                <div class="file-sub">
                  <span class="file-meta">{{ formatSize(file.taille) }}</span>
                  <span class="file-dot">·</span>
                  <span class="file-date">{{ file.createdAt | date:'dd/MM/yyyy' }}</span>
                </div>
              </div>
              <span class="file-badge" [class]="'fb-' + getFileIconClass(file.nom)">{{ getFileExtLabel(file.nom) }}</span>
              <div class="file-actions">
                <button class="file-btn" (click)="downloadFile(file)" title="Télécharger">
                  <span class="material-symbols-rounded">download</span>
                </button>
                <button class="file-btn" (click)="editFile(file)" title="Modifier">
                  <span class="material-symbols-rounded">edit</span>
                </button>
                <button class="file-btn danger" (click)="confirmDeleteFile(file)" title="Supprimer">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div class="modal-overlay" *ngIf="showNewFolderModal || showEditFolderModal || showEditFileModal || showDeleteModal" 
           (click)="closeAllModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          
          <!-- New Folder -->
          <div *ngIf="showNewFolderModal" class="modal-content">
            <div class="modal-header">
              <span class="material-symbols-rounded">create_new_folder</span>
              <h3>Nouveau dossier</h3>
              <button class="close-btn" (click)="showNewFolderModal = false">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-field">
                <label>Nom du dossier</label>
                <input type="text" [(ngModel)]="newFolderName" placeholder="Entrez le nom..." class="input">
              </div>
              <div class="form-field">
                <label>Couleur</label>
                <div class="color-grid">
                  <button *ngFor="let c of folderColors" 
                    class="color-btn" 
                    [style.background]="c"
                    [class.selected]="newFolderColor === c"
                    (click)="newFolderColor = c">
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="showNewFolderModal = false">Annuler</button>
              <button class="btn-primary" (click)="createFolder()" [disabled]="!newFolderName.trim()">
                <span class="material-symbols-rounded">add</span>
                Créer
              </button>
            </div>
          </div>

          <!-- Edit Folder -->
          <div *ngIf="showEditFolderModal" class="modal-content">
            <div class="modal-header">
              <span class="material-symbols-rounded">folder</span>
              <h3>Modifier dossier</h3>
              <button class="close-btn" (click)="showEditFolderModal = false">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-field">
                <label>Nom du dossier</label>
                <input type="text" [(ngModel)]="editFolderForm.nom" class="input">
              </div>
              <div class="form-field">
                <label>Couleur</label>
                <div class="color-grid">
                  <button *ngFor="let c of folderColors" 
                    class="color-btn" 
                    [style.background]="c"
                    [class.selected]="editFolderForm.couleur === c"
                    (click)="editFolderForm.couleur = c">
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-danger" (click)="deleteFolder()">
                <span class="material-symbols-rounded">delete</span>
                Supprimer
              </button>
              <div class="footer-right">
                <button class="btn-secondary" (click)="showEditFolderModal = false">Annuler</button>
                <button class="btn-primary" (click)="updateFolder()">
                  <span class="material-symbols-rounded">save</span>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          <!-- Edit File -->
          <div *ngIf="showEditFileModal" class="modal-content">
            <div class="modal-header">
              <span class="material-symbols-rounded">description</span>
              <h3>Modifier fichier</h3>
              <button class="close-btn" (click)="showEditFileModal = false">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-field">
                <label>Nom</label>
                <input type="text" [(ngModel)]="editFileForm.nom" class="input">
              </div>
              <div class="form-field">
                <label>Type</label>
                <select [(ngModel)]="editFileForm.type" class="input select">
                  <option value="CONTRAT">Contrat</option>
                  <option value="CIN">CIN</option>
                  <option value="RC">Registre de Commerce</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div class="form-field">
                <label>Note</label>
                <textarea [(ngModel)]="editFileForm.remarque" class="input textarea" rows="3" placeholder="Note ou remarque..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="showEditFileModal = false">Annuler</button>
              <button class="btn-primary" (click)="updateFile()">
                <span class="material-symbols-rounded">save</span>
                Enregistrer
              </button>
            </div>
          </div>

          <!-- Delete Confirm -->
          <div *ngIf="showDeleteModal" class="modal-content modal-sm">
            <div class="modal-header danger">
              <span class="material-symbols-rounded">warning</span>
              <h3>Confirmer la suppression</h3>
            </div>
            <div class="modal-body center">
              <p>Voulez-vous vraiment supprimer <strong>{{ deleteTarget?.nom }}</strong> ?</p>
            </div>
            <div class="modal-footer center">
              <button class="btn-secondary" (click)="showDeleteModal = false">Annuler</button>
              <button class="btn-danger" (click)="executeDelete()">
                <span class="material-symbols-rounded">delete</span>
                Supprimer
              </button>
            </div>
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
    .fm-container {
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.04);
    }

    .fm-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 28px;
      background: linear-gradient(135deg, #F8FAFC 0%, #fff 100%);
      border-bottom: 1px solid #E2E8F0;
    }

    .fm-breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .crumb-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: none;
      background: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      color: #64748B;
      transition: all 0.2s;
    }

    .crumb-btn:hover { background: #E2E8F0; }
    .crumb-btn.active { color: #059669; font-weight: 600; background: #D1FAE5; }

    .fm-actions { display: flex; gap: 12px; }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: 1px solid #E2E8F0;
      background: #fff;
      border-radius: 12px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #475569;
      transition: all 0.2s;
    }

    .action-btn:hover { background: #F1F5F9; }
    .action-btn.upload { background: #059669; color: #fff; border-color: #059669; }
    .action-btn.upload:hover { background: #047857; }

    .fm-content {
      position: relative;
      min-height: 400px;
      padding: 24px;
    }

    .fm-content.drag-active { background: #F0FDF4; }

    .drop-overlay {
      position: absolute;
      inset: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(5, 150, 105, 0.08);
      border: 2px dashed #059669;
      border-radius: 16px;
      z-index: 10;
    }

    .drop-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #059669;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 36px;
      margin-bottom: 16px;
      animation: bounce 0.5s ease infinite alternate;
    }

    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-8px); }
    }

    .drop-overlay p { font-size: 1.1rem; font-weight: 600; color: #059669; }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      color: #94A3B8;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #E2E8F0;
      border-top-color: #059669;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #F1F5F9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      color: #CBD5E1;
      margin-bottom: 16px;
    }

    .empty-state p { font-size: 1.2rem; font-weight: 600; color: #64748B; margin: 0; }
    .empty-state span { font-size: 0.9rem; color: #94A3B8; margin-top: 8px; }

    .section { margin-bottom: 32px; }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      color: #64748B;
    }

    .section-header h3 { font-size: 0.9rem; font-weight: 600; text-transform: uppercase; margin: 0; }
    .section-header .count {
      padding: 2px 10px;
      background: #E2E8F0;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .folders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 14px;
    }

    .folder-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 22px 14px 18px;
      background: #fff;
      border: 1.5px solid #E5E7EB;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .folder-card:hover {
      border-color: #A5B4FC;
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.1);
      transform: translateY(-2px);
    }

    .folder-icon-pro {
      width: 52px;
      height: 52px;
      margin-bottom: 10px;
      svg { width: 100%; height: 100%; }
    }

    .folder-name {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1E293B;
      text-align: center;
      word-break: break-word;
    }

    .folder-more {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px;
      border: none;
      background: none;
      border-radius: 6px;
      cursor: pointer;
      color: #94A3B8;
      opacity: 0;
      transition: all 0.15s;
      .material-symbols-rounded { font-size: 18px; }
    }

    .folder-card:hover .folder-more { opacity: 1; }
    .folder-more:hover { background: #EEF2FF; color: #4F46E5; }

    .files-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .file-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: #fff;
      border: 1.5px solid #E5E7EB;
      border-radius: 14px;
      transition: all 0.2s;
    }

    .file-card:hover {
      border-color: #C7D2FE;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.08);
    }

    /* Pro File Icon */
    .file-icon-pro {
      position: relative;
      width: 44px;
      height: 52px;
      min-width: 44px;
      color: #94A3B8;
      svg { width: 100%; height: 100%; }
    }
    .file-icon-pro.pdf  { color: #EF4444; }
    .file-icon-pro.xls  { color: #22C55E; }
    .file-icon-pro.doc  { color: #3B82F6; }
    .file-icon-pro.img  { color: #8B5CF6; }
    .file-icon-pro.zip  { color: #F59E0B; }
    .file-icon-pro.ppt  { color: #F97316; }
    .file-icon-pro.txt  { color: #64748B; }

    .fip-ext {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.55rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: currentColor;
    }

    .file-details { flex: 1; min-width: 0; }
    .file-name {
      display: block;
      font-weight: 600;
      font-size: 0.9rem;
      color: #1E293B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .file-sub {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .file-meta { font-size: 0.75rem; color: #64748B; }
    .file-dot  { font-size: 0.6rem; color: #CBD5E1; }
    .file-date { font-size: 0.75rem; color: #94A3B8; }

    .file-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #F1F5F9;
      color: #64748B;
    }
    .fb-pdf { background: #FEF2F2; color: #EF4444; }
    .fb-xls { background: #F0FDF4; color: #16A34A; }
    .fb-doc { background: #EFF6FF; color: #2563EB; }
    .fb-img { background: #F5F3FF; color: #7C3AED; }
    .fb-zip { background: #FFFBEB; color: #D97706; }
    .fb-ppt { background: #FFF7ED; color: #EA580C; }

    .file-actions { display: flex; gap: 2px; }

    .file-btn {
      padding: 7px;
      border: none;
      background: none;
      border-radius: 8px;
      cursor: pointer;
      color: #94A3B8;
      transition: all 0.15s;
      .material-symbols-rounded { font-size: 20px; }
    }

    .file-btn:hover { background: #EEF2FF; color: #4F46E5; }
    .file-btn.danger:hover { background: #FEF2F2; color: #EF4444; }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal { width: 100%; max-width: 440px; }

    .modal-content {
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.2);
      animation: slideUp 0.3s ease;
    }

    .modal-sm { max-width: 380px; }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #F8FAFC 0%, #fff 100%);
      border-bottom: 1px solid #E2E8F0;
    }

    .modal-header.danger { background: linear-gradient(135deg, #FEE2E2 0%, #fff 100%); }
    .modal-header .material-symbols-rounded { font-size: 24px; color: #059669; }
    .modal-header.danger .material-symbols-rounded { color: #DC2626; }
    .modal-header h3 { flex: 1; font-size: 1.1rem; margin: 0; }
    .close-btn {
      padding: 8px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 10px;
      color: #94A3B8;
    }
    .close-btn:hover { background: #E2E8F0; }

    .modal-body { padding: 24px; }
    .modal-body.center { text-align: center; }
    .modal-body p { font-size: 1rem; color: #475569; margin: 0; }

    .form-field { margin-bottom: 20px; }
    .form-field:last-child { margin-bottom: 0; }
    .form-field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
    }

    .input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      font-size: 0.95rem;
      transition: all 0.2s;
    }
    .input:focus { outline: none; border-color: #059669; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1); }
    .input.select, .input.textarea { cursor: pointer; }

    .color-grid { display: flex; gap: 10px; flex-wrap: wrap; }
    .color-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 3px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }
    .color-btn.selected { border-color: #1E293B; transform: scale(1.1); }

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
    }

    .modal-footer.center { justify-content: center; gap: 12px; }
    .footer-right { display: flex; gap: 10px; }

    .btn-primary, .btn-secondary, .btn-danger {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-primary { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(5, 150, 105, 0.3); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary { background: #fff; color: #475569; border: 1px solid #E2E8F0; }
    .btn-secondary:hover { background: #F1F5F9; }

    .btn-danger { background: #DC2626; color: #fff; }
    .btn-danger:hover { background: #B91C1C; }

    .toast {
      position: fixed;
      bottom: 32px;
      right: 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-radius: 14px;
      font-weight: 500;
      z-index: 200;
      animation: slideIn 0.3s ease;
    }

    .toast-ok { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; }
    .toast-err { background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color: #fff; }

    @keyframes slideIn {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ClientFilesPageComponent implements OnInit {
  @Input() client!: Client;

  folders: ClientFolder[] = [];
  files: ClientFileItem[] = [];
  loading = false;
  toast = '';
  toastType: 'ok' | 'err' = 'ok';
  isDragging = false;
  currentFolderId: number | null = null;
  breadcrumb: ClientFolder[] = [];

  showNewFolderModal = false;
  newFolderName = '';
  newFolderColor = '#6B7280';
  folderColors = ['#6B7280', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777'];

  showEditFolderModal = false;
  editFolderTarget: ClientFolder | null = null;
  editFolderForm: Partial<ClientFolder> = {};

  showEditFileModal = false;
  editFileTarget: ClientFileItem | null = null;
  editFileForm: Partial<ClientFileItem> = {};

  showDeleteModal = false;
  deleteTarget: ClientFileItem | ClientFolder | null = null;
  deleteType: 'file' | 'folder' = 'file';

  constructor(
    private filesService: ClientFilesService,
    private foldersService: ClientFoldersService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCurrentFolder();
  }

  loadCurrentFolder(): void {
    this.loading = true;
    this.foldersService.getFolders(this.client.id!).subscribe({
      next: (folders) => {
        this.folders = folders.filter(f => f.parentId === this.currentFolderId);
        this.loadFiles();
      },
      error: () => {
        this.loading = false;
        this.showToast('Erreur chargement dossiers', 'err');
      }
    });
  }

  loadFiles(): void {
    this.filesService.getFiles(this.client.id!, this.currentFolderId).subscribe({
      next: (files) => {
        this.files = files;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.showToast('Erreur chargement fichiers', 'err');
      }
    });
  }

  openFolder(folder: ClientFolder): void {
    if (!this.breadcrumb.find(b => b.id === folder.id)) {
      this.breadcrumb.push(folder);
    }
    this.currentFolderId = folder.id!;
    this.loadCurrentFolder();
  }

  navigateToFolder(folderId: number | null): void {
    this.currentFolderId = folderId;
    if (folderId === null) {
      this.breadcrumb = [];
    } else {
      const idx = this.breadcrumb.findIndex(f => f.id === folderId);
      if (idx >= 0) this.breadcrumb = this.breadcrumb.slice(0, idx + 1);
    }
    this.loadCurrentFolder();
  }

  createFolder(): void {
    if (!this.newFolderName.trim()) return;
    this.foldersService.createFolder(this.client.id!, {
      nom: this.newFolderName.trim(),
      parentId: this.currentFolderId,
      couleur: this.newFolderColor
    }).subscribe({
      next: () => {
        this.showNewFolderModal = false;
        this.newFolderName = '';
        this.showToast('Dossier créé', 'ok');
        this.loadCurrentFolder();
      },
      error: () => this.showToast('Erreur création dossier', 'err')
    });
  }

  showFolderMenu(folder: ClientFolder, event: Event): void {
    event.stopPropagation();
    this.editFolderTarget = folder;
    this.editFolderForm = { nom: folder.nom, couleur: folder.couleur };
    this.showEditFolderModal = true;
  }

  updateFolder(): void {
    if (!this.editFolderTarget) return;
    this.foldersService.updateFolder(this.client.id!, this.editFolderTarget.id!, this.editFolderForm).subscribe({
      next: () => {
        this.showEditFolderModal = false;
        this.showToast('Dossier modifié', 'ok');
        this.loadCurrentFolder();
      },
      error: () => this.showToast('Erreur modification', 'err')
    });
  }

  deleteFolder(): void {
    if (!this.editFolderTarget) return;
    this.foldersService.deleteFolder(this.client.id!, this.editFolderTarget.id!).subscribe({
      next: () => {
        this.showEditFolderModal = false;
        this.showToast('Dossier supprimé', 'ok');
        this.loadCurrentFolder();
      },
      error: () => this.showToast('Erreur suppression', 'err')
    });
  }

  triggerFileInput(): void {
    const input = document.querySelector('.fm-actions input[type="file"]') as HTMLInputElement;
    input?.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    Array.from(input.files).forEach(file => {
      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('nom', file.name);
      fd.append('type', 'AUTRE');
      if (this.currentFolderId) fd.append('folderId', String(this.currentFolderId));

      this.filesService.uploadFile(this.client.id!, fd).subscribe({
        next: (f) => {
          this.files.unshift(f);
          this.showToast('Fichier ajouté', 'ok');
          this.cdr.detectChanges();
        },
        error: () => this.showToast('Erreur upload', 'err')
      });
    });
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      const fakeEvent = { target: { files } } as any;
      this.onFilesSelected(fakeEvent);
    }
  }

  editFile(file: ClientFileItem): void {
    this.editFileTarget = file;
    this.editFileForm = { nom: file.nom, type: file.type, remarque: file.remarque };
    this.showEditFileModal = true;
  }

  updateFile(): void {
    if (!this.editFileTarget) return;
    this.filesService.updateFile(this.client.id!, this.editFileTarget.id!, this.editFileForm).subscribe({
      next: (updated) => {
        const idx = this.files.findIndex(f => f.id === updated.id);
        if (idx >= 0) this.files[idx] = updated;
        this.showEditFileModal = false;
        this.showToast('Fichier modifié', 'ok');
      },
      error: () => this.showToast('Erreur modification', 'err')
    });
  }

  downloadFile(file: ClientFileItem): void {
    window.open(this.filesService.getDownloadUrl(this.client.id!, file.id!), '_blank');
  }

  confirmDeleteFile(file: ClientFileItem): void {
    this.deleteTarget = file;
    this.deleteType = 'file';
    this.showDeleteModal = true;
  }

  executeDelete(): void {
    if (!this.deleteTarget) return;
    if (this.deleteType === 'file') {
      this.filesService.deleteFile(this.client.id!, this.deleteTarget.id!).subscribe({
        next: () => {
          this.files = this.files.filter(f => f.id !== this.deleteTarget!.id);
          this.showDeleteModal = false;
          this.showToast('Fichier supprimé', 'ok');
        },
        error: () => this.showToast('Erreur suppression', 'err')
      });
    } else {
      this.foldersService.deleteFolder(this.client.id!, this.deleteTarget.id!).subscribe({
        next: () => {
          this.showDeleteModal = false;
          this.showEditFolderModal = false;
          this.showToast('Dossier supprimé', 'ok');
          this.loadCurrentFolder();
        },
        error: () => this.showToast('Erreur suppression', 'err')
      });
    }
  }

  closeAllModals(): void {
    this.showNewFolderModal = false;
    this.showEditFolderModal = false;
    this.showEditFileModal = false;
    this.showDeleteModal = false;
  }

  getFileIconClass(nameOrType: string): string {
    const t = (nameOrType || '').toLowerCase();
    if (t.endsWith('.pdf') || t.includes('pdf')) return 'pdf';
    if (t.endsWith('.xls') || t.endsWith('.xlsx') || t.endsWith('.csv') || t.includes('excel')) return 'xls';
    if (t.endsWith('.doc') || t.endsWith('.docx') || t.includes('word')) return 'doc';
    if (t.endsWith('.ppt') || t.endsWith('.pptx') || t.includes('powerpoint')) return 'ppt';
    if (t.endsWith('.jpg') || t.endsWith('.jpeg') || t.endsWith('.png') || t.endsWith('.gif') || t.endsWith('.webp') || t.endsWith('.svg') || t.includes('image')) return 'img';
    if (t.endsWith('.zip') || t.endsWith('.rar') || t.endsWith('.7z') || t.endsWith('.tar')) return 'zip';
    if (t.endsWith('.txt') || t.endsWith('.log')) return 'txt';
    return '';
  }

  getFileExtLabel(name: string): string {
    const ext = (name || '').split('.').pop()?.toUpperCase() || '';
    if (ext.length > 4) return 'FILE';
    return ext || 'FILE';
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '0 o';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
  }

  showToast(msg: string, type: 'ok' | 'err'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => { this.toast = ''; this.cdr.detectChanges(); }, 3000);
    this.cdr.detectChanges();
  }
}