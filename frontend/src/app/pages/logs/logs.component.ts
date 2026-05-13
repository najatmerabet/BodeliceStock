import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogsService } from '../../services/logs.service';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent implements OnInit {

  logs: any[] = [];
  filteredLogs: any[] = [];

  searchQuery = '';
  activeFilter = 'ALL';

  filterOptions = [
    { label: 'TOUS',   value: 'ALL'    },
    { label: 'CREATE', value: 'CREATE' },
    { label: 'UPDATE', value: 'UPDATE' },
    { label: 'DELETE', value: 'DELETE' },
  ];

  constructor(
    private logsService: LogsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.logsService.getAll().subscribe({
      next: (data) => {
        this.logs = data;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err),
    });
  }

  setFilter(value: string): void {
    this.activeFilter = value;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.logs];

    if (this.activeFilter !== 'ALL') {
      result = result.filter(l => l.action === this.activeFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(l =>
        l.user.email.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q),
      );
    }

    this.filteredLogs = result;
  }

  trackByLog(index: number, log: any): any {
    return log.id;
  }
}