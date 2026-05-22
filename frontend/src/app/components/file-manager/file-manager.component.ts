import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientFilesService } from '../../services/client-files.service';
import { ClientFoldersService } from '../../services/client-folders.service';
import { Client } from '../../models/clients.model';
import { ClientFileItem, ClientFolder } from '../../models/client-file.model';

@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fm-container">
      <!-- Toolbar -->
      <div class="fm-toolbar">
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
          <button class="fm-btn" (click)="showNewFolderModal = true">
            <span class="material-symbols-rounded">create_new_folder</span>
            Nouveau dossier
          </button>
          <button class="fm-btn primary" (click)="triggerFileInput()">
            <span class="material-symbols-rounded">upload_file</span>
            Ajouter fichier
          </button>
          <input #fileInput type="file" multiple hidden (change)="onFilesSelected($event)">
        </div>
      </div>

      <!-- Content -->
      <div class="fm-content" (dragover)="onDragOver($event)" (drop)="onDrop($event)" [class.drag-active]="isDragging">
        <div class="drop-overlay" *ngIf="isDragging">
          <span class="material-symbols-rounded">upload_file</span>
          <p>Déposez vos fichiers ici</p>
        </div>

        <!-- Loading -->
        <div class="fm-loading" *ngIf="loading">
          <span class="material-symbols-rounded">hourglass_empty</span>
          <p>Chargement...</p>
        </div>

        <!-- Empty -->
        <div class="fm-empty" *ngIf="!loading && folders.length === 0 && files.length === 0">
          <span class="material-symbols-rounded">folder_open</span>
          <p>Dossier vide</p>
          <span class="hint">Glissez-déposez des fichiers ou cliquez sur 'Ajouter fichier'</span>
        </div>

        <!-- Folders Grid -->
        <div class="fm-section" *ngIf="folders.length > 0">
          <h4 class="section-title">
            <span class="material-symbols-rounded">folder</span>
            Dossiers ({{ folders.length }})
          </h4>
          <div class="items-grid">
            <div class="folder-card" *ngFor="let folder of folders" (click)="openFolder(folder)">
              <div class="folder-icon" [style.background]="folder.couleur + '20'" [style.color]="folder.couleur">
                <span class="material-symbols-rounded">folder</span>
              </div>
              <span class="folder-name">{{ folder.nom }}</span>
              <div class="folder-actions" (click)="$event.stopPropagation(); showFolderMenu(folder, $event)">
                <span class="material-symbols-rounded">more_vert</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Files Grid -->
        <div class="fm-section" *ngIf="files.length > 0">
          <h4 class="section-title">
            <span class="material-symbols-rounded">description</span>
            Fichiers ({{ files.length }})
          </h4>
          <div class="files-list">
            <div class="file-item" *ngFor="let file of files">
              <div class="file-icon" [class]="getFileIconClass(file.type)">
                <span class="material-symbols-rounded">{{ getFileIcon(file.type) }}</span>
              </div>
              <div class="file-info">
                <span class="file-name">{{ file.nom }}</span>
                <span class="file-meta">{{ formatSize(file.taille) }} • {{ file.createdAt | date:'dd/MM/yyyy' }}</span>
              </div>
              <div class="file-type-badge">{{ file.type }}</div>
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

      <!-- New Folder Modal -->
      <div class="modal-overlay" *ngIf="showNewFolderModal" (click)="showNewFolderModal = false">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nouveau dossier</h3>
            <button class="modal-close" (click)="showNewFolderModal = false">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="modal-body">
            <label>Nom du dossier</label>
            <input type="text" [(ngModel)]="newFolderName" placeholder="Nom du dossier" class="form-input">
            <label style="margin-top:12px;">Couleur</label>
            <div class="color-picker">
              <button *ngFor="let c of folderColors" 
                class="color-btn" 
                [style.background]="c"
                [class.selected]="newFolderColor === c"
                (click)="newFolderColor = c">
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showNewFolderModal = false">Annuler</button>
            <button class="btn-primary" (click)="createFolder()" [disabled]="!newFolderName.trim()">Créer</button>
          </div>
        </div>
      </div>

      <!-- Edit Folder Modal -->
      <div class="modal-overlay" *ngIf="showEditFolderModal" (click)="showEditFolderModal = false">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Modifier dossier</h3>
            <button class="modal-close" (click)="showEditFolderModal = false">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="modal-body">
            <label>Nom du dossier</label>
            <input type="text" [(ngModel)]="editFolderForm.nom" class="form-input">
            <label style="margin-top:12px;">Couleur</label>
            <div class="color-picker">
              <button *ngFor="let c of folderColors" 
                class="color-btn" 
                [style.background]="c"
                [class.selected]="editFolderForm.couleur === c"
                (click)="editFolderForm.couleur = c">
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-danger" (click)="deleteFolder()">Supprimer</button>
            <button class="btn-secondary" (click)="showEditFolderModal = false">Annuler</button>
            <button class="btn-primary" (click)="updateFolder()">Enregistrer</button>
          </div>
        </div>
      </div>

      <!-- Edit File Modal -->
      <div class="modal-overlay" *ngIf="showEditFileModal" (click)="showEditFileModal = false">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Modifier fichier</h3>
            <button class="modal-close" (click)="showEditFileModal = false">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="modal-body">
            <label>Nom</label>
            <input type="text" [(ngModel)]="editFileForm.nom" class="form-input">
            <label style="margin-top:12px;">Type</label>
            <select [(ngModel)]="editFileForm.type" class="form-input">
              <option value="CONTRAT">Contrat</option>
              <option value="CIN">CIN</option>
              <option value="RC">Registre de Commerce</option>
              <option value="AUTRE">Autre</option>
            </select>
            <label style="margin-top:12px;">Note</label>
            <textarea [(ngModel)]="editFileForm.remarque" class="form-input" rows="3" placeholder="Note ou remarque..."></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showEditFileModal = false">Annuler</button>
            <button class="btn-primary" (click)="updateFile()">Enregistrer</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation -->
      <div class="modal-overlay" *ngIf="showDeleteModal" (click)="showDeleteModal = false">
        <div class="modal-box modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Confirmer la suppression</h3>
          </div>
          <div class="modal-body">
            <p>Voulez-vous vraiment supprimer <strong>{{ deleteTarget?.nom }}</strong> ?</p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showDeleteModal = false">Annuler</button>
            <button class="btn-danger" (click)="executeDelete()">Supprimer</button>
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
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .fm-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #F8FAFC;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .fm-breadcrumb {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .crumb-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border: none;
      background: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      color: #64748B;
    }

    .crumb-btn:hover { background: #E2E8F0; }
    .crumb-btn.active { color: #1E293B; font-weight: 600; }

    .fm-actions { display: flex; gap: 8px; }

    .fm-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid #E2E8F0;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      color: #475569;
    }

    .fm-btn:hover { background: #F1F5F9; }
    .fm-btn.primary { background: #059669; color: #fff; border-color: #059669; }
    .fm-btn.primary:hover { background: #047857; }

    .fm-content {
      flex: 1;
      padding: 16px;
      background: #F8FAFC;
      border-radius: 12px;
      position: relative;
      overflow-y: auto;
    }

    .fm-content.drag-active { background: #F0FDF4; border: 2px dashed #059669; }

    .drop-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(5, 150, 105, 0.1);
      border-radius: 12px;
      z-index: 10;
    }

    .drop-overlay .material-symbols-rounded { font-size: 48px; color: #059669; }
    .drop-overlay p { margin-top: 8px; font-weight: 600; color: #059669; }

    .fm-loading, .fm-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #94A3B8;
    }

    .fm-empty .material-symbols-rounded { font-size: 64px; margin-bottom: 12px; }
    .fm-empty p { font-size: 1.1rem; font-weight: 600; color: #64748B; }
    .fm-empty .hint { font-size: 0.85rem; margin-top: 8px; }

    .fm-section { margin-bottom: 24px; }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #64748B;
      margin-bottom: 12px;
      text-transform: uppercase;
    }

    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }

    .folder-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 12px;
      background: #fff;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .folder-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

    .folder-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 8px;
    }

    .folder-name {
      font-size: 0.75rem;
      font-weight: 500;
      text-align: center;
      color: #334155;
      word-break: break-word;
    }

    .folder-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .folder-card:hover .folder-actions { opacity: 1; }
    .folder-actions:hover { background: #E2E8F0; }

    .files-list { display: flex; flex-direction: column; gap: 8px; }

    .file-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #fff;
      border-radius: 10px;
      transition: all 0.2s;
    }

    .file-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

    .file-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      background: #F1F5F9;
      color: #64748B;
    }

    .file-icon.pdf { background: #FEE2E2; color: #DC2626; }
    .file-icon.image { background: #DBEAFE; color: #2563EB; }
    .file-icon.word { background: #DBEAFE; color: #2563EB; }
    .file-icon.excel { background: #D1FAE5; color: #059669; }

    .file-info { flex: 1; min-width: 0; }
    .file-name { display: block; font-weight: 500; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .file-meta { font-size: 0.75rem; color: #94A3B8; }

    .file-type-badge {
      padding: 4px 8px;
      background: #F1F5F9;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748B;
    }

    .file-actions { display: flex; gap: 4px; }

    .file-btn {
      padding: 6px;
      border: none;
      background: none;
      border-radius: 6px;
      cursor: pointer;
      color: #64748B;
    }

    .file-btn:hover { background: #E2E8F0; color: #334155; }
    .file-btn.danger:hover { background: #FEE2E2; color: #DC2626; }

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
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .modal-sm { max-width: 340px; }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #E2E8F0;
    }

    .modal-header h3 { margin: 0; font-size: 1.1rem; }

    .modal-close {
      padding: 4px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 6px;
    }

    .modal-close:hover { background: #F1F5F9; }

    .modal-body { padding: 20px; }

    .modal-body label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 6px;
      color: #475569;
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .form-input:focus {
      outline: none;
      border-color: #059669;
    }

    .color-picker { display: flex; gap: 8px; flex-wrap: wrap; }

    .color-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 2px solid transparent;
      cursor: pointer;
    }

    .color-btn.selected { border-color: #1E293B; }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #E2E8F0;
    }

    .btn-primary, .btn-secondary, .btn-danger {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .btn-primary { background: #059669; color: #fff; }
    .btn-primary:hover { background: #047857; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary { background: #F1F5F9; color: #475569; }
    .btn-secondary:hover { background: #E2E8F0; }

    .btn-danger { background: #DC2626; color: #fff; }
    .btn-danger:hover { background: #B91C1C; }

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
export class FileManagerComponent implements OnInit {
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

  getFileIcon(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return 'picture_as_pdf';
    if (t.includes('jpg') || t.includes('png') || t.includes('image')) return 'image';
    if (t.includes('doc') || t.includes('word')) return 'description';
    if (t.includes('xls') || t.includes('excel')) return 'table_chart';
    return 'insert_drive_file';
  }

  getFileIconClass(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return 'pdf';
    if (t.includes('jpg') || t.includes('png') || t.includes('image')) return 'image';
    if (t.includes('doc') || t.includes('word')) return 'word';
    if (t.includes('xls') || t.includes('excel')) return 'excel';
    return '';
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