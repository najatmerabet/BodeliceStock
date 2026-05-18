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

  filterDateFrom = '';
  filterDateTo = '';

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalCount = 0;

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
    const params: any = {
      page: this.currentPage,
      pageSize: this.pageSize,
    };

    if (this.activeFilter !== 'ALL') {
      params.action = this.activeFilter;
    }
    if (this.filterDateFrom) {
      params.startDate = this.filterDateFrom;
    }
    if (this.filterDateTo) {
      params.endDate = this.filterDateTo;
    }

    this.logsService.getLogs(params).subscribe({
      next: (result) => {
        this.logs = result.data || [];
        this.totalCount = result.total || 0;
        this.totalPages = result.totalPages || 1;
        this.applyLocalFilters();
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err),
    });
  }

  setFilter(value: string): void {
    this.activeFilter = value;
    this.currentPage = 1;
    this.loadLogs();
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  applyLocalFilters(): void {
    const logs = this.logs || [];
    let result = [...logs];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.user?.email || '').toLowerCase().includes(q) ||
        (l.entity || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q),
      );
    }

    this.filteredLogs = result;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadLogs();
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadLogs();
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "AUJOURD'HUI";
    if (date.toDateString() === yesterday.toDateString()) return "HIER";
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  }

  get groupedLogs(): { date: string; label: string; logs: any[] }[] {
    const logs = this.filteredLogs || [];
    const groups: { [key: string]: any[] } = {};
    logs.forEach(log => {
      const dateKey = new Date(log.createdAt).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return Object.entries(groups).map(([date, logsArr]) => ({
      date,
      label: this.getDateLabel(date),
      logs: logsArr,
    }));
  }

  trackByLog(index: number, log: any): any {
    return log.id;
  }
}