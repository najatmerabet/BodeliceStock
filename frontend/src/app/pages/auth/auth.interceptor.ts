import {
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse
} from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { Router } from "@angular/router";

import { MatSnackBar } from '@angular/material/snack-bar';
import { switchMap, catchError, throwError } from "rxjs";
@Injectable()
export class authInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {

    const token = this.authService.getToken();

    let authReq = req;

    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(authReq).pipe(
  catchError((error: HttpErrorResponse) => {

    if (error.status === 401) {

      const refreshToken = this.authService.getRefreshToken();

      if (!refreshToken) {
        this.logoutUser();
        return throwError(() => error);
      }

      // 👉 essayer refresh token
      return this.authService.refreshToken(refreshToken).pipe(
        switchMap((res: any) => {

          this.authService.saveAccessToken(res.accessToken);

          const retryReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${res.accessToken}`
            }
          });

          return next.handle(retryReq);
        }),
        catchError(() => {
          this.logoutUser();
          return throwError(() => error);
        })
      );
    }

    return throwError(() => error);
  })
);
  }


private logoutUser() {
  this.authService.logout();
  this.router.navigate(['/auth/login']);

  this.snackBar.open("Session expirée", "OK", {
    duration: 3000
  });
}


}