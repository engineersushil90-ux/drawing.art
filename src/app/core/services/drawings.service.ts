import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Artwork {
  title: string;
  category: string;
  year: string;
  date?: string;
  image: string;
  alt: string;
}

export interface LikeResponse {
  image: string;
  likes: number;
}

@Injectable({
  providedIn: 'root'
})
export class DrawingsService {
  private readonly http = inject(HttpClient);

  getDrawings(): Observable<Artwork[]> {
    return this.http.get<Artwork[]>('/api/drawings');
  }

  getLikes(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>('/api/likes');
  }

  likeDrawing(image: string): Observable<LikeResponse> {
    return this.http.post<LikeResponse>('/api/likes', {
      image
    });
  }

  getVisits(): Observable<number> {
  return this.http.get<number>('/api/visits');
  }

  recordVisit(): Observable<VisitResponse> {
    return this.http.post<VisitResponse>('/api/visits', {});
  }
}

export interface VisitResponse {
  visits: number;
}