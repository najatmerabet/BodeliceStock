import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-auth',
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class Auth {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  login(): void {
    this.loading = true;
    this.error = '';
    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Email ou mot de passe incorrect';
        this.cdr.detectChanges();
      }
    });
  }

}
