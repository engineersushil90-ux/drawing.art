import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { timeout } from 'rxjs/operators';

export interface Artwork {
  title: string;
  category: string;
  year: string;
  date?: string;
  modifiedAt?: string;
  addedAt?: string;
  image: string;
  imageSmall?: string;
  imageLarge?: string;
  imageSmallWidth?: number;
  imageLargeWidth?: number;
  alt: string;
  suggestedBy?: string;
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
  likesByImage?: Record<string, number>;
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

export interface ArtworkReview {
  id: string;
  imagePath: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ModerationArtworkReview extends ArtworkReview {
  status: 'pending' | 'approved' | 'rejected';
}

export interface CustomDrawingRequest {
  id: string;
  name: string;
  email: string;
  description: string;
  requestType?: 'commission' | 'sketch' | 'comic';
  createdAt: string;
  hasReferenceImage: boolean;
}

export interface AdminDrawing {
  image: string;
  imageSmall: string;
  title: string;
  category: string;
}

const API_BASE_URL = 'https://drawing-art.onrender.com';

export function normalizeImagePath(image: string, category?: string): string {
  const imagePath = image.startsWith(API_BASE_URL)
    ? image.slice(API_BASE_URL.length)
    : image;
  const normalizedPath = imagePath.replace(/^\/+/, '');

  if (category === '18+ Sketches' && normalizedPath.startsWith('api/18plus/image?')) {
    const query = normalizedPath.slice(normalizedPath.indexOf('?') + 1);
    const file = new URLSearchParams(query).get('file');
    if (file) {
      return `drawings/18+Sketches/${file.replace(/^\/+/, '')}`;
    }
  }

  return normalizedPath;
}

@Injectable({
  providedIn: 'root'
})
export class DrawingsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = API_BASE_URL;
  private adminAccessToken = '';

  getDrawings(imageAccessToken = ''): Observable<Artwork[]> {
    const tokenQuery = imageAccessToken
      ? `?access_token=${encodeURIComponent(imageAccessToken)}`
      : '';
    return this.http.get<Artwork[]>(`${this.apiBaseUrl}/api/drawings${tokenQuery}`, {
      withCredentials: true
    }).pipe(map(drawings => drawings.map(artwork => ({
      ...artwork,
      ...(artwork.category === '18+ Sketches'
        ? { image: `${this.apiBaseUrl}${artwork.image}` }
        : {}),
      ...(artwork.imageSmall?.startsWith('/api/')
        ? { imageSmall: `${this.apiBaseUrl}${artwork.imageSmall}` }
        : {}),
      ...(artwork.imageLarge?.startsWith('/api/')
        ? { imageLarge: `${this.apiBaseUrl}${artwork.imageLarge}` }
        : {})
    }))));
  }

  getBuildDrawings(): Observable<Artwork[]> {
    return this.http.get<Artwork[]>('/gallery.json');
  }

  registerAdultViewer(details: { name: string; email: string; isAdult: boolean }): Observable<AdultAccessResponse> {
    return this.http.post<AdultAccessResponse>(`${this.apiBaseUrl}/api/18plus/confirm`, details, {
      withCredentials: true
    });
  }

  getAdultViewerCount(): Observable<{ viewerCount: number }> {
    return this.http.get<{ viewerCount: number }>(`${this.apiBaseUrl}/api/18plus/viewer-count`);
  }

  verifyAdultEmailLink(details: { name: string; email: string; isAdult: boolean; accessToken: string }): Observable<AdultAccessResponse> {
    return this.http.post<AdultAccessResponse>(`${this.apiBaseUrl}/api/18plus/verify-link`, details, {
      withCredentials: true
    });
  }

  adminLogin(details: { username: string; password: string }): Observable<{ ok: boolean; accessToken: string }> {
    return this.http.post<{ ok: boolean; accessToken: string }>(`${this.apiBaseUrl}/api/admin/login`, details, {
      withCredentials: true,
      timeout: 30000
    }).pipe(
      timeout(30000),
      map(response => {
        this.adminAccessToken = response.accessToken;
        return response;
      })
    );
  }

  getAdminSession(): Observable<{ ok: boolean }> {
    return this.http.get<{ ok: boolean }>(`${this.apiBaseUrl}/api/admin/session`, {
      headers: this.adminHeaders(),
      withCredentials: true
    }).pipe(timeout(8000));
  }

  uploadSketch(
    file: File,
    category: 'Pencil Sketches' | 'Color Art' | '18+ Sketches',
    suggestedBy = ''
  ): Observable<{ ok: boolean; image: string; category: string }> {
    const formData = new FormData();
    formData.append('category', category);
    formData.append('suggestedBy', suggestedBy);
    formData.append('image', file, file.name);
    return this.http.post<{ ok: boolean; image: string; category: string }>(
      `${this.apiBaseUrl}/api/admin/drawings`,
      formData,
      { headers: this.adminHeaders(), withCredentials: true }
    );
  }

  getAdminDrawings(): Observable<AdminDrawing[]> {
    return this.http.get<AdminDrawing[]>(`${this.apiBaseUrl}/api/admin/drawings`, {
      headers: this.adminHeaders(),
      withCredentials: true
    }).pipe(map(drawings => drawings.map(drawing => ({
      ...drawing,
      imageSmall: `${this.apiBaseUrl}${drawing.imageSmall}`
    }))));
  }

  deleteAdminDrawing(image: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.apiBaseUrl}/api/admin/drawings`, {
      headers: this.adminHeaders(),
      withCredentials: true,
      body: { image }
    });
  }

  getComicPages(comicId: string, partId: string): Observable<string[]> {
    const params = new HttpParams().set('comic', comicId).set('part', partId);
    return this.http.get<{ pages: string[] }>(`${this.apiBaseUrl}/api/hindi-comics/pages`, { params }).pipe(
      timeout(15_000),
      map(response => response.pages.map(page =>
        page.startsWith('/api/') ? `${this.apiBaseUrl}${page}` : page
      ))
    );
  }

  uploadComicPage(
    file: File,
    comicId: string,
    partId: string
  ): Observable<{ ok: boolean; page: string; pageNumber: number }> {
    const formData = new FormData();
    formData.append('comicId', comicId);
    formData.append('partId', partId);
    formData.append('image', file, file.name);
    return this.http.post<{ ok: boolean; page: string; pageNumber: number }>(
      `${this.apiBaseUrl}/api/admin/hindi-comics/pages`,
      formData,
      { headers: this.adminHeaders(), withCredentials: true }
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

  likeDrawing(image: string, category?: string): Observable<LikeResponse> {
    return this.http.post<LikeResponse>(`${this.apiBaseUrl}/api/likes`, {
      image: normalizeImagePath(image, category)
    });
  }

  getArtworkReviews(image: string, category: string, adultAccessToken = ''): Observable<ArtworkReview[]> {
    let params = new HttpParams().set('image', normalizeImagePath(image, category));
    if (adultAccessToken) params = params.set('access_token', adultAccessToken);
    return this.http.get<ArtworkReview[]>(`${this.apiBaseUrl}/api/reviews`, { params });
  }

  getArtworkReviewCounts(adultAccessToken = ''): Observable<Record<string, number>> {
    let params = new HttpParams();
    if (adultAccessToken) params = params.set('access_token', adultAccessToken);
    return this.http.get<Record<string, number>>(`${this.apiBaseUrl}/api/review-counts`, {
      params,
      withCredentials: true
    });
  }

  submitArtworkReview(
    image: string,
    category: string,
    review: { name: string; rating: number; comment: string; website: string },
    adultAccessToken = ''
  ): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiBaseUrl}/api/reviews`, {
      image: normalizeImagePath(image, category),
      name: review.name,
      rating: review.rating,
      comment: review.comment,
      website: review.website,
      ...(adultAccessToken ? { access_token: adultAccessToken } : {})
    });
  }

  getPendingArtworkReviews(): Observable<ModerationArtworkReview[]> {
    return this.http.get<ModerationArtworkReview[]>(`${this.apiBaseUrl}/api/admin/reviews`, {
      headers: this.adminHeaders(),
      withCredentials: true
    });
  }

  getAdminReviewImageUrl(imagePath: string): string {
    const params = new HttpParams().set('image', imagePath);
    return `${this.apiBaseUrl}/api/admin/review-image?${params.toString()}`;
  }

  getAdminCustomDrawingRequestImageUrl(id: string): string {
    return `${this.apiBaseUrl}/api/admin/custom-drawing-requests/${encodeURIComponent(id)}/reference`;
  }

  moderateArtworkReview(id: string, status: 'approved' | 'rejected'): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(
      `${this.apiBaseUrl}/api/admin/reviews/${encodeURIComponent(id)}`,
      { status },
      { headers: this.adminHeaders(), withCredentials: true }
    );
  }

  submitCustomDrawingRequest(
    request: { name: string; email: string; description: string; website: string; requestType?: 'commission' | 'sketch' | 'comic' },
    referenceImage?: File
  ): Observable<{ ok: boolean }> {
    const formData = new FormData();
    formData.append('name', request.name);
    formData.append('email', request.email);
    formData.append('description', request.description);
    formData.append('website', request.website);
    if (request.requestType) formData.append('requestType', request.requestType);
    if (referenceImage) formData.append('referenceImage', referenceImage);
    return this.http.post<{ ok: boolean }>(`${this.apiBaseUrl}/api/custom-drawing-requests`, formData);
  }

  getCustomDrawingRequests(): Observable<CustomDrawingRequest[]> {
    return this.http.get<CustomDrawingRequest[]>(`${this.apiBaseUrl}/api/admin/custom-drawing-requests`, {
      headers: this.adminHeaders(),
      withCredentials: true
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
