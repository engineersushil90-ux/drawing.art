import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Trek {
  id: number;
  name: string;
  difficulty: string;
}

@Injectable({ providedIn: 'root' })
export class TrekService {
  private apiUrl = 'http://localhost:3000/treks';

  constructor(private http: HttpClient) {}

  getTreks(): Observable<Trek[]> {
    return this.http.get<Trek[]>(this.apiUrl);
  }
}
