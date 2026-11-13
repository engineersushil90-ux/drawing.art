import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { timeout } from 'rxjs/operators';

export interface Artwork {
  title: string;
  category: string;
  year: string;
  date?: string;
  modifiedAt?: string;
  image: string;
  alt: string;
  isFreePreview?: boolean;
  isPayment?: boolean;
}

export interface LikeResponse {
  image: string;
  likes: number;
}

export interface DailyActivityResponse {
  date: string;
  likes: number;
  visits: number;
}

export interface AdultViewer {
  name: string;
  email: string;
  firstViewedAt: string;
  lastViewedAt: string;
  views: number;
  isPayment: boolean;
  paymentRequestedAt?: string | null;
}

export interface AdultAccessResponse {
  ok: boolean;
  imageAccessToken: string;
  isPayment: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DrawingsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'https://drawing-art.onrender.com';
  private adminAccessToken = '';

  getDrawings(imageAccessToken = ''): Observable<Artwork[]> {
    const tokenQuery = imageAccessToken
      ? `?access_token=${encodeURIComponent(imageAccessToken)}`
      : '';
    return this.http.get<Artwork[]>(`${this.apiBaseUrl}/api/drawings${tokenQuery}`, {
      withCredentials: true
    }).pipe(map(drawings => drawings.map(artwork => artwork.category === '18+ Sketches'
      ? { ...artwork, image: `${this.apiBaseUrl}${artwork.image}` }
      : artwork)));
  }

  registerAdultViewer(details: { name: string; email: string; isAdult: boolean }): Observable<AdultAccessResponse> {
    return this.http.post<AdultAccessResponse>(`${this.apiBaseUrl}/api/18plus/confirm`, details, {
      withCredentials: true
    });
  }

  verifyAdultEmailLink(details: { name: string; email: string; isAdult: boolean; accessToken: string }): Observable<AdultAccessResponse> {
    return this.http.post<AdultAccessResponse>(`${this.apiBaseUrl}/api/18plus/verify-link`, details, {
      withCredentials: true
    });
  }

  adminLogin(details: { username: string; password: string }): Observable<{ ok: boolean; accessToken: string }> {
    return this.http.post<{ ok: boolean; accessToken: string }>(`${this.apiBaseUrl}/api/admin/login`, details, {
      withCredentials: true
    }).pipe(
      timeout(15000),
      map(response => {
        this.adminAccessToken = response.accessToken;
        return response;
      })
    );
  }

  getAdultViewers(): Observable<AdultViewer[]> {
    return this.http.get<AdultViewer[]>(`${this.apiBaseUrl}/api/admin/18plus-viewers`, {
      headers: this.adminHeaders(),
      withCredentials: true
    });
  }

  setAdultViewerPayment(email: string, isPayment: boolean): Observable<{ ok: boolean; isPayment: boolean }> {
    return this.http.patch<{ ok: boolean; isPayment: boolean }>(
      `${this.apiBaseUrl}/api/admin/18plus-viewers/payment`,
      { email, isPayment },
      { headers: this.adminHeaders(), withCredentials: true }
    );
  }

  requestAdultPaymentApproval(imageAccessToken: string): Observable<{ ok: boolean; paymentRequestedAt: string }> {
    return this.http.post<{ ok: boolean; paymentRequestedAt: string }>(
      `${this.apiBaseUrl}/api/18plus/payment-request`,
      { access_token: imageAccessToken },
      { withCredentials: true }
    );
  }

  private adminHeaders(): { Authorization?: string } {
    return this.adminAccessToken ? { Authorization: `Bearer ${this.adminAccessToken}` } : {};
  }

  getLikes(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.apiBaseUrl}/api/likes`);
  }

  likeDrawing(image: string): Observable<LikeResponse> {
    return this.http.post<LikeResponse>(`${this.apiBaseUrl}/api/likes`, {
      image
    });
  }

  getVisits(): Observable<number> {
  return this.http.get<number>(`${this.apiBaseUrl}/api/visits`);
  }

  getTodayActivity(): Observable<DailyActivityResponse> {
    return this.http.get<DailyActivityResponse>(`${this.apiBaseUrl}/api/today`);
  }

  recordVisit(): Observable<VisitResponse> {
    return this.http.post<VisitResponse>(`${this.apiBaseUrl}/api/visits`, {});
  }
}

export interface VisitResponse {
  visits: number;
}
