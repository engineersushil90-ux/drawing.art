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

@Injectable({
  providedIn: 'root'
})
export class DrawingsService {

  private readonly http = inject(HttpClient);

  getDrawings(): Observable<Artwork[]> {
    return this.http.get<Artwork[]>('/api/drawings');
  }
}

const categoryMap: Record<string, string> = {
  ColorArt: 'Color Art',
  PencilSketches: 'Pencil Sketches',
  '18+Sketches': '18+ Sketches',
  FeatureDrawing: 'Feature Drawing'
};