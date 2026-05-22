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
    return this.http.post<{ accessToken: string; refreshToken: string; user: User }>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => { 
        localStorage.setItem('accessToken', res.accessToken); 
        localStorage.setItem('refreshToken', res.refreshToken);
        localStorage.setItem('user', JSON.stringify(res.user));
      })
    );
  }

  logout() { 
     localStorage.removeItem('accessToken');
     localStorage.removeItem('refreshToken');
     localStorage.removeItem('user');
  }

 getToken() {
  return localStorage.getItem('accessToken');
}

getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  refreshToken(refreshToken: string) {
  return this.http.post<{ accessToken: string }>(
    '/api/auth/refresh',
    { refreshToken }
  );
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

  saveAccessToken(token: string) {
  localStorage.setItem('accessToken', token);
}
}
