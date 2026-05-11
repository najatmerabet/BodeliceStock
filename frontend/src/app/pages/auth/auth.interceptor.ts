import { HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { AuthService } from "../../services/auth.service";
import { Injectable } from "@angular/core";

@Injectable()
export class authInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {

    const token = this.authService.getToken();

    if (!token) {
      return next.handle(req);
    }
     console.log('INTERCEPTOR EXECUTED');
console.log('TOKEN:', this.authService.getToken());
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(cloned);
  }
}