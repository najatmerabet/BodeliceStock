import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

export interface User {
  id: number;
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl= '/api/auth';
  constructor(private http: HttpClient) {}

  login(credentials: { email: string; password: string }) {
    return this.http.post<{ token: string; user: User }>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => { 
        localStorage.setItem('token', res.token); 
        localStorage.setItem('user', JSON.stringify(res.user));
      })
    );
  }

  logout() { 
     localStorage.removeItem('token');
     localStorage.removeItem('user');
  }

  setToken(token: string) {
    localStorage.setItem('token', token);
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  fetchCurrentUser() {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap(user => localStorage.setItem('user', JSON.stringify(user)))
    );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }
}
