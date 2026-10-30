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
}

@Injectable({
  providedIn: 'root'
})
export class DrawingsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'https://drawing-art.onrender.com';

  getDrawings(): Observable<Artwork[]> {
    return this.http.get<Artwork[]>(`${this.apiBaseUrl}/api/drawings`, {
      withCredentials: true
    }).pipe(map(drawings => drawings.map(artwork => artwork.category === '18+ Sketches'
      ? { ...artwork, image: `${this.apiBaseUrl}${artwork.image}` }
      : artwork)));
  }

  confirmAdultAccess(details: { name: string; email: string; isAdult: boolean }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiBaseUrl}/api/18plus/confirm`, details, {
      withCredentials: true
    });
  }

  adminLogin(details: { username: string; password: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiBaseUrl}/api/admin/login`, details, {
      withCredentials: true
    }).pipe(timeout(60000));
  }

  getAdultViewers(): Observable<AdultViewer[]> {
    return this.http.get<AdultViewer[]>(`${this.apiBaseUrl}/api/admin/18plus-viewers`, {
      withCredentials: true
    });
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
