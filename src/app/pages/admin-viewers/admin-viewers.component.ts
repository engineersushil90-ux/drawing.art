import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, timeout } from 'rxjs';
import {
  AdminDrawing,
  AdultViewer,
  CustomDrawingRequest,
  DrawingsService,
  ModerationArtworkReview
} from '../../core/services/drawings.service';
import { HINDI_COMICS } from '../hindi-comics/hindi-comics.data';

@Component({
  selector: 'app-admin-viewers',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <main class="admin-page">
      <a routerLink="/" class="back-link">← drawing.art</a>
      <section class="admin-card">
        <p class="eyebrow">Owner access</p>
        <h1>18+ Sketches viewers</h1>

        <p *ngIf="checkingAdminSession" class="login-hint" role="status">Checking your saved admin session…</p>

        <form *ngIf="!authenticated" (ngSubmit)="login()">
          <label>Admin username or email<input name="username" type="text" autocomplete="username" [(ngModel)]="username" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required></label>
          <button type="submit" [disabled]="busy">{{ busy ? 'Connecting…' : 'Sign in' }}</button>
          <p class="login-hint" *ngIf="busy" role="status">Connecting to the server and checking the database. If there is no response within 30 seconds, the request will be canceled and an error will appear.</p>
        </form>

        <p class="message" *ngIf="message" role="status">{{ message }}</p>

        <div *ngIf="authenticated" class="viewer-list">
          <div class="list-heading">
            <div>
              <p class="description">Unique registered emails: <strong>{{ viewers.length | number }}</strong></p>
              <p class="privacy-note">Email ownership is not verified.</p>
            </div>
            <button type="button" class="refresh-button" [disabled]="loadingViewers" (click)="loadViewers(true)">
              {{ loadingViewers ? 'Loading…' : 'Refresh' }}
            </button>
          </div>

          <p *ngIf="viewersMessage" class="message" role="status">{{ viewersMessage }}</p>
          <p *ngIf="loadingViewers" role="status">Loading viewer list…</p>
          <p *ngIf="!loadingViewers && !viewers.length">No registered viewers yet.</p>

          <div class="table-wrap" *ngIf="!loadingViewers && viewers.length">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Last viewed</th><th>Views</th></tr></thead>
              <tbody><tr *ngFor="let viewer of viewersOnPage">
                <td>{{ viewer.name }}</td>
                <td>{{ viewer.email }}</td>
                <td>{{ viewer.lastViewedAt | date:'medium' }}</td>
                <td>{{ viewer.views }}</td>
              </tr></tbody>
            </table>
          </div>
          <nav *ngIf="!loadingViewers && viewerPageCount > 1" class="viewer-pagination" aria-label="Viewer list pages">
            <button type="button" [disabled]="viewerPage === 1" (click)="previousViewerPage()">Previous</button>
            <span>Page {{ viewerPage }} of {{ viewerPageCount }}</span>
            <button type="button" [disabled]="viewerPage === viewerPageCount" (click)="nextViewerPage()">Next</button>
          </nav>
        </div>

        <section *ngIf="authenticated" class="review-moderation" aria-labelledby="review-moderation-title">
          <div class="list-heading">
            <div>
              <h2 id="review-moderation-title">Review moderation</h2>
              <p class="description">Pending reviews: <strong>{{ pendingReviews.length | number }}</strong></p>
            </div>
            <button type="button" class="refresh-button" [disabled]="loadingReviews" (click)="loadPendingReviews(true)">
              {{ loadingReviews ? 'Loading…' : 'Refresh reviews' }}
            </button>
          </div>

          <p *ngIf="reviewsMessage" class="message" role="status">{{ reviewsMessage }}</p>
          <p *ngIf="loadingReviews" role="status">Loading pending reviews…</p>
          <p *ngIf="!loadingReviews && !pendingReviews.length">No reviews awaiting moderation.</p>

          <article class="moderation-review" *ngFor="let review of reviewsOnPage">
            <div class="moderation-review-heading">
              <strong>{{ review.name }}</strong>
              <span>{{ review.rating }} / 5</span>
              <time [attr.datetime]="review.createdAt">{{ review.createdAt | date:'medium' }}</time>
            </div>
            <div class="moderation-review-content">
              <img
                *ngIf="!reviewImageErrors[review.id]"
                class="moderation-artwork-preview"
                [src]="getReviewArtworkImageUrl(review)"
                crossorigin="use-credentials"
                loading="lazy"
                decoding="async"
                alt="Artwork being reviewed"
                (error)="onReviewArtworkImageError(review)"
              >
              <div *ngIf="reviewImageErrors[review.id]" class="moderation-artwork-error" role="status">
                Artwork preview unavailable
              </div>
              <p class="review-image">{{ review.imagePath }}</p>
              <p class="moderation-comment">{{ review.comment }}</p>
              <div class="moderation-actions">
                <button
                  type="button"
                  [disabled]="moderatingReviewId === review.id"
                  (click)="moderateReview(review, 'approved')"
                >{{ moderatingReviewId === review.id && moderatingReviewStatus === 'approved' ? 'Approving…' : 'Approve' }}</button>
                <button
                  type="button"
                  class="reject-button"
                  [disabled]="moderatingReviewId === review.id"
                  (click)="moderateReview(review, 'rejected')"
                >{{ moderatingReviewId === review.id && moderatingReviewStatus === 'rejected' ? 'Rejecting…' : 'Reject' }}</button>
              </div>
            </div>
          </article>
          <nav *ngIf="!loadingReviews && reviewPageCount > 1" class="viewer-pagination" aria-label="Review list pages">
            <button type="button" [disabled]="reviewPage === 1" (click)="previousReviewPage()">Previous</button>
            <span>Page {{ reviewPage }} of {{ reviewPageCount }}</span>
            <button type="button" [disabled]="reviewPage === reviewPageCount" (click)="nextReviewPage()">Next</button>
          </nav>
        </section>

        <section *ngIf="authenticated" class="drawing-request-list" aria-labelledby="drawing-requests-title">
          <div class="list-heading">
            <div>
              <h2 id="drawing-requests-title">Custom drawing requests</h2>
              <p class="description">Requests received: <strong>{{ customDrawingRequests.length | number }}</strong></p>
            </div>
            <button type="button" class="refresh-button" [disabled]="loadingDrawingRequests" (click)="loadCustomDrawingRequests(true)">
              {{ loadingDrawingRequests ? 'Loading…' : 'Refresh requests' }}
            </button>
          </div>

          <p *ngIf="drawingRequestsMessage" class="message" role="status">{{ drawingRequestsMessage }}</p>
          <p *ngIf="loadingDrawingRequests" role="status">Loading drawing requests…</p>
          <p *ngIf="!loadingDrawingRequests && !customDrawingRequests.length">No custom drawing requests yet.</p>

          <article class="drawing-request" *ngFor="let request of drawingRequestsOnPage">
            <div class="moderation-review-heading">
              <strong>{{ request.name }}</strong>
              <time [attr.datetime]="request.createdAt">{{ request.createdAt | date:'medium' }}</time>
            </div>
            <a [href]="'mailto:' + request.email">{{ request.email }}</a>
            <p class="moderation-comment">{{ request.description }}</p>
            <img
              *ngIf="request.hasReferenceImage && !customRequestImageErrors[request.id]"
              class="request-reference-preview"
              [src]="getCustomDrawingRequestImageUrl(request)"
              crossorigin="use-credentials"
              loading="lazy"
              decoding="async"
              alt="Reference image submitted with drawing request"
              (error)="onCustomRequestImageError(request)"
            >
            <p *ngIf="request.hasReferenceImage && customRequestImageErrors[request.id]" class="image-error" role="status">
              Reference image unavailable.
            </p>
          </article>
          <nav *ngIf="!loadingDrawingRequests && drawingRequestPageCount > 1" class="viewer-pagination" aria-label="Drawing request list pages">
            <button type="button" [disabled]="drawingRequestPage === 1" (click)="previousDrawingRequestPage()">Previous</button>
            <span>Page {{ drawingRequestPage }} of {{ drawingRequestPageCount }}</span>
            <button type="button" [disabled]="drawingRequestPage === drawingRequestPageCount" (click)="nextDrawingRequestPage()">Next</button>
          </nav>
        </section>

        <section *ngIf="authenticated" class="sketch-upload" aria-labelledby="sketch-upload-title">
          <h2 id="sketch-upload-title">Upload a sketch</h2>
          <p class="description">Choose a collection and upload a JPG, PNG, or WebP image (15 MB max).</p>
          <form (ngSubmit)="uploadSketch()">
            <label>
              Collection
              <select name="sketchCategory" [(ngModel)]="sketchCategory">
                <option value="Pencil Sketches">Pencil Sketches</option>
                <option value="Color Art">Color Art</option>
                <option value="18+ Sketches">18+ Sketches</option>
              </select>
            </label>
            <label>
              Sketch image
              <input
                #sketchUploadInput
                type="file"
                accept="image/jpeg,image/png,image/webp"
                (change)="onSketchFileSelected($event)"
                required
              >
            </label>
            <p *ngIf="selectedSketchFile" class="login-hint">{{ selectedSketchFile.name }}</p>
            <button type="submit" [disabled]="uploadingSketch || !selectedSketchFile">
              {{ uploadingSketch ? 'Uploading…' : 'Upload sketch' }}
            </button>
          </form>
          <p *ngIf="sketchUploadMessage" [class.upload-success]="sketchUploadSucceeded" class="message" role="status">
            {{ sketchUploadMessage }}
          </p>
          <a *ngIf="sketchUploadSucceeded" routerLink="/" fragment="work" class="gallery-link">Open gallery</a>
        </section>

        <section *ngIf="authenticated" class="uploaded-drawings" aria-labelledby="uploaded-drawings-title">
          <div class="list-heading">
            <div>
              <h2 id="uploaded-drawings-title">Uploaded sketches</h2>
              <p class="description">Manage sketches uploaded here. Gallery files included in the site are not deletable.</p>
            </div>
            <button type="button" class="refresh-button" [disabled]="loadingAdminDrawings" (click)="loadAdminDrawings(true)">
              {{ loadingAdminDrawings ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
          <p *ngIf="adminDrawingsMessage" class="message" role="status">{{ adminDrawingsMessage }}</p>
          <p *ngIf="loadingAdminDrawings" role="status">Loading uploaded sketches…</p>
          <p *ngIf="!loadingAdminDrawings && !adminDrawings.length">No uploaded sketches yet.</p>
          <div class="uploaded-drawing-list" *ngIf="!loadingAdminDrawings && adminDrawings.length">
            <article class="uploaded-drawing" *ngFor="let drawing of adminDrawings">
              <img [src]="drawing.imageSmall" [alt]="drawing.title" loading="lazy">
              <div>
                <strong>{{ drawing.title }}</strong>
                <p class="description">{{ drawing.category }}</p>
                <button
                  type="button"
                  class="delete-drawing-button"
                  [disabled]="deletingDrawingImage !== null"
                  (click)="deleteUploadedDrawing(drawing)"
                >
                  {{ deletingDrawingImage === drawing.image ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section *ngIf="authenticated" class="comic-upload" aria-labelledby="comic-upload-title">
          <h2 id="comic-upload-title">Upload a Hindi comic page</h2>
          <p class="description">Choose a comic and part, then upload pages one at a time in reading order. JPG, PNG, or WebP (15 MB max).</p>
          <form (ngSubmit)="uploadComicPage()">
            <label>
              Comic
              <select
                name="comicPageComicId"
                [(ngModel)]="comicPageComicId"
                (ngModelChange)="onComicPageComicChanged($event)"
              >
                <option *ngFor="let comic of hindiComics" [value]="comic.id">{{ comic.title }}</option>
              </select>
            </label>
            <label>
              Part
              <select name="comicPagePartId" [(ngModel)]="comicPagePartId">
                <option *ngFor="let part of selectedComicParts" [value]="part.id">{{ part.title }}</option>
              </select>
            </label>
            <label>
              Comic page image
              <input
                #comicPageUploadInput
                type="file"
                accept="image/jpeg,image/png,image/webp"
                (change)="onComicPageFileSelected($event)"
                required
              >
            </label>
            <p *ngIf="selectedComicPageFile" class="login-hint">{{ selectedComicPageFile.name }}</p>
            <button type="submit" [disabled]="uploadingComicPage || !selectedComicPageFile || !comicPagePartId">
              {{ uploadingComicPage ? 'Uploading…' : 'Upload comic page' }}
            </button>
          </form>
          <p *ngIf="comicPageUploadMessage" [class.upload-success]="comicPageUploadSucceeded" class="message" role="status">
            {{ comicPageUploadMessage }}
          </p>
        </section>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;background:#f7f1e8;color:#26342d;font-family:Arial,sans-serif}
    .admin-page{max-width:1050px;margin:auto;padding:40px 24px}.back-link{color:inherit;text-decoration:none}
    .admin-card{margin:9vh auto 0;max-width:900px;background:#fffdf9;padding:clamp(24px,5vw,52px);border-radius:18px;box-shadow:0 16px 50px #26342d12}
    .eyebrow{text-transform:uppercase;letter-spacing:2px;font-size:12px;color:#9c6355}
    h1{font:42px Georgia,serif;margin:10px 0 28px}
    form{display:grid;gap:18px;max-width:430px}label{display:grid;gap:8px;font-size:14px}
    input{padding:13px;border:1px solid #d8d4cc;border-radius:8px;font:inherit}
    button{padding:13px 18px;border:0;border-radius:8px;background:#26342d;color:white;font:inherit;cursor:pointer}
    button:disabled{opacity:.6;cursor:not-allowed}.message{color:#9a3428}
    .login-hint,.privacy-note{margin:0;color:#647069;font-size:13px;line-height:1.5}
    .list-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:12px 0 20px}
    .description{margin:0 0 4px;color:#647069}.description strong{color:#26342d}
    .refresh-button{padding:9px 14px}.table-wrap{overflow:auto}
    table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}
    th,td{padding:12px;border-bottom:1px solid #e8e2d9;white-space:nowrap}th{font-weight:600}
    .viewer-pagination{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px}
    .viewer-pagination button{padding:8px 12px}.viewer-pagination button:disabled{opacity:.5;cursor:not-allowed}
    .review-moderation{margin-top:42px;padding-top:30px;border-top:1px solid #e8e2d9}
    .review-moderation h2{margin:0 0 8px;font:26px Georgia,serif}
    .moderation-review{padding:18px 0;border-bottom:1px solid #e8e2d9}
    .moderation-review-heading{display:flex;flex-wrap:wrap;gap:14px;align-items:baseline}
    .moderation-review-heading time,.review-image{color:#647069;font-size:12px}
    .review-image{overflow-wrap:anywhere}
    .moderation-review-content{margin-top:12px}
    .moderation-artwork-preview{display:block;max-width:min(100%,520px);max-height:520px;margin:12px 0;border-radius:8px;background:#f7f1e8;object-fit:contain}
    .moderation-artwork-error{display:grid;place-items:center;width:min(100%,520px);min-height:180px;border-radius:8px;background:#f7f1e8;color:#647069;font-size:13px}
    .image-error{color:#8c3d31;font-size:13px}
    .moderation-comment{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}
    .moderation-actions{display:flex;gap:10px}
    .reject-button{background:#8c3d31}
    .drawing-request-list{margin-top:42px;padding-top:30px;border-top:1px solid #e8e2d9}
    .drawing-request-list h2{margin:0 0 8px;font:26px Georgia,serif}
    .drawing-request{padding:18px 0;border-bottom:1px solid #e8e2d9}
    .drawing-request>a{color:#8c5c4d;overflow-wrap:anywhere}
    .request-reference-preview{display:block;max-width:min(100%,520px);max-height:520px;margin-top:14px;border-radius:10px;object-fit:contain;background:#f7f1e8}
    .sketch-upload{margin-top:42px;padding-top:30px;border-top:1px solid #e8e2d9}
    .sketch-upload h2{margin:0 0 8px;font:26px Georgia,serif}
    .sketch-upload form{margin-top:20px}
    .sketch-upload select{padding:13px;border:1px solid #d8d4cc;border-radius:8px;background:#fffdf9;font:inherit}
    .uploaded-drawings{margin-top:42px;padding-top:30px;border-top:1px solid #e8e2d9}
    .uploaded-drawings h2{margin:0 0 8px;font:26px Georgia,serif}
    .uploaded-drawing-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:18px}
    .uploaded-drawing{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid #e8e2d9;border-radius:10px}
    .uploaded-drawing img{width:88px;height:88px;border-radius:6px;object-fit:cover;background:#f7f1e8}
    .uploaded-drawing strong{overflow-wrap:anywhere}
    .uploaded-drawing .description{margin:5px 0}
    .delete-drawing-button{padding:8px 12px;background:#8c3d31}
    .comic-upload{margin-top:42px;padding-top:30px;border-top:1px solid #e8e2d9}
    .comic-upload h2{margin:0 0 8px;font:26px Georgia,serif}
    .comic-upload form{margin-top:20px}
    .comic-upload select{padding:13px;border:1px solid #d8d4cc;border-radius:8px;background:#fffdf9;font:inherit}
    .upload-success{color:#356b3a}
    .gallery-link{display:inline-block;margin-top:4px;color:#8c5c4d}
    @media(max-width:600px){.admin-page{padding:24px 16px}.admin-card{margin-top:7vh}h1{font-size:34px}.list-heading{align-items:flex-start}}
  `]
})
export class AdminViewersComponent implements OnInit, OnDestroy {
  private readonly drawingsService = inject(DrawingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChild('sketchUploadInput') private sketchUploadInput?: ElementRef<HTMLInputElement>;
  @ViewChild('comicPageUploadInput') private comicPageUploadInput?: ElementRef<HTMLInputElement>;
  private loginDeadline: ReturnType<typeof setTimeout> | undefined;
  private loginSubscription: Subscription | undefined;
  readonly hindiComics = HINDI_COMICS;
  username = '';
  password = '';
  busy = false;
  checkingAdminSession = true;
  authenticated = false;
  loadingViewers = false;
  viewersMessage = '';
  readonly pageSize = 20;
  viewerPage = 1;
  reviewPage = 1;
  drawingRequestPage = 1;
  message = '';
  viewers: AdultViewer[] = [];
  pendingReviews: ModerationArtworkReview[] = [];
  reviewImageErrors: Record<string, boolean> = {};
  loadingReviews = false;
  moderatingReviewId: string | null = null;
  moderatingReviewStatus: 'approved' | 'rejected' | null = null;
  reviewsMessage = '';
  customDrawingRequests: CustomDrawingRequest[] = [];
  loadingDrawingRequests = false;
  drawingRequestsMessage = '';
  customRequestImageErrors: Record<string, boolean> = {};
  sketchCategory: 'Pencil Sketches' | 'Color Art' | '18+ Sketches' = 'Pencil Sketches';
  selectedSketchFile: File | null = null;
  uploadingSketch = false;
  sketchUploadMessage = '';
  sketchUploadSucceeded = false;
  adminDrawings: AdminDrawing[] = [];
  loadingAdminDrawings = false;
  deletingDrawingImage: string | null = null;
  adminDrawingsMessage = '';
  comicPageComicId = HINDI_COMICS[0]?.id ?? '';
  comicPagePartId = HINDI_COMICS[0]?.parts[0]?.id ?? '';
  selectedComicPageFile: File | null = null;
  uploadingComicPage = false;
  comicPageUploadMessage = '';
  comicPageUploadSucceeded = false;

  get selectedComicParts() {
    return this.hindiComics.find(comic => comic.id === this.comicPageComicId)?.parts ?? [];
  }

  get viewerPageCount(): number {
    return Math.ceil(this.viewers.length / this.pageSize);
  }

  get viewersOnPage(): AdultViewer[] {
    const start = (this.viewerPage - 1) * this.pageSize;
    return this.viewers.slice(start, start + this.pageSize);
  }

  get reviewPageCount(): number {
    return Math.ceil(this.pendingReviews.length / this.pageSize);
  }

  get reviewsOnPage(): ModerationArtworkReview[] {
    const start = (this.reviewPage - 1) * this.pageSize;
    return this.pendingReviews.slice(start, start + this.pageSize);
  }

  get drawingRequestPageCount(): number {
    return Math.ceil(this.customDrawingRequests.length / this.pageSize);
  }

  get drawingRequestsOnPage(): CustomDrawingRequest[] {
    const start = (this.drawingRequestPage - 1) * this.pageSize;
    return this.customDrawingRequests.slice(start, start + this.pageSize);
  }

  previousViewerPage(): void {
    this.viewerPage = Math.max(1, this.viewerPage - 1);
  }

  nextViewerPage(): void {
    this.viewerPage = Math.min(this.viewerPageCount, this.viewerPage + 1);
  }

  previousReviewPage(): void {
    this.reviewPage = Math.max(1, this.reviewPage - 1);
  }

  nextReviewPage(): void {
    this.reviewPage = Math.min(this.reviewPageCount, this.reviewPage + 1);
  }

  previousDrawingRequestPage(): void {
    this.drawingRequestPage = Math.max(1, this.drawingRequestPage - 1);
  }

  nextDrawingRequestPage(): void {
    this.drawingRequestPage = Math.min(this.drawingRequestPageCount, this.drawingRequestPage + 1);
  }

  ngOnInit(): void {
    this.drawingsService.getAdminSession().pipe(timeout(30_000)).subscribe({
      next: () => {
        this.checkingAdminSession = false;
        this.authenticated = true;
        this.loadAdminData();
        this.cdr.markForCheck();
      },
      error: error => {
        this.checkingAdminSession = false;
        if (!this.authenticated && error?.status !== 401) {
          this.message = error?.name === 'TimeoutError'
            ? 'No response while checking the saved admin session. You can still sign in below.'
            : error?.error?.error || 'Could not verify your saved admin session. Please sign in again.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearLoginDeadline();
    this.loginSubscription?.unsubscribe();
  }

  login(): void {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    this.loginDeadline = setTimeout(() => {
      if (!this.busy) return;
      this.loginSubscription?.unsubscribe();
      this.loginSubscription = undefined;
      this.busy = false;
      this.message = 'No response from the server within 30 seconds. Login request was canceled. Check Render and Supabase availability, then retry.';
      this.cdr.detectChanges();
    }, 30_000);
    this.loginSubscription = this.drawingsService.adminLogin({
      username: this.username.trim(),
      password: this.password
    }).subscribe({
      next: () => {
        this.clearLoginDeadline();
        this.loginSubscription = undefined;
        this.busy = false;
        this.authenticated = true;
        this.password = '';
        this.message = 'Signed in successfully.';
        this.loadAdminData();
        this.cdr.markForCheck();
      },
      error: error => {
        this.clearLoginDeadline();
        this.loginSubscription = undefined;
        this.busy = false;
        this.message = this.getLoginErrorMessage(error);
        this.cdr.markForCheck();
      }
    });
  }

  private clearLoginDeadline(): void {
    if (this.loginDeadline) clearTimeout(this.loginDeadline);
    this.loginDeadline = undefined;
  }

  private loadAdminData(): void {
    this.loadViewers();
    this.loadPendingReviews();
    this.loadCustomDrawingRequests();
    this.loadAdminDrawings();
  }

  private getLoginErrorMessage(error: { error?: { error?: string }; name?: string; status?: number }): string {
    if (error?.error?.error) return error.error.error;
    if (error?.name === 'TimeoutError') return 'Login timed out after 30 seconds. Check Render and Supabase availability, then retry.';
    if (error?.status === 401) return 'Username or password is incorrect.';
    if (error?.status === 0) return 'Could not reach the API server. It may be waking up, or the network/CORS request failed. Please retry.';
    if (error?.status === 503) return 'The login service or database is unavailable. Check the Render server logs and Supabase connection.';
    return 'Login failed' + (error?.status ? ` (HTTP ${error.status})` : '') + '. Please retry or check the Render server logs.';
  }

  loadViewers(showSuccessMessage = false): void {
    if (this.loadingViewers) return;
    this.loadingViewers = true;
    this.viewersMessage = '';
    this.drawingsService.getAdultViewers().pipe(timeout(30_000)).subscribe({
      next: viewers => {
        this.viewers = [...viewers].sort(
          (left, right) => Date.parse(right.lastViewedAt) - Date.parse(left.lastViewedAt)
        );
        this.viewerPage = 1;
        this.loadingViewers = false;
        if (showSuccessMessage) this.viewersMessage = 'Viewer list refreshed.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.loadingViewers = false;
        this.viewersMessage = this.getLoadErrorMessage(error, 'the viewer list');
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  loadPendingReviews(showSuccessMessage = false): void {
    if (this.loadingReviews) return;
    this.loadingReviews = true;
    this.reviewsMessage = '';
    this.drawingsService.getPendingArtworkReviews().pipe(timeout(30_000)).subscribe({
      next: reviews => {
        this.pendingReviews = reviews;
        this.reviewPage = 1;
        this.reviewImageErrors = {};
        this.loadingReviews = false;
        if (showSuccessMessage) this.reviewsMessage = 'Pending reviews refreshed.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.loadingReviews = false;
        this.reviewsMessage = this.getLoadErrorMessage(error, 'pending reviews');
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  moderateReview(review: ModerationArtworkReview, status: 'approved' | 'rejected'): void {
    if (this.moderatingReviewId) return;
    this.moderatingReviewId = review.id;
    this.moderatingReviewStatus = status;
    this.reviewsMessage = '';
    this.drawingsService.moderateArtworkReview(review.id, status).pipe(timeout(30_000)).subscribe({
      next: () => {
        this.pendingReviews = this.pendingReviews.filter(item => item.id !== review.id);
        this.reviewPage = Math.min(this.reviewPage, Math.max(1, this.reviewPageCount));
        this.moderatingReviewId = null;
        this.moderatingReviewStatus = null;
        this.reviewsMessage = status === 'approved'
          ? 'Review approved and published. Open this artwork’s Reviews & feedback to see it.'
          : 'Review rejected.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.moderatingReviewId = null;
        this.moderatingReviewStatus = null;
        this.reviewsMessage = error?.name === 'TimeoutError'
          ? 'No response after 30 seconds. Refresh reviews to confirm whether the change was saved before retrying.'
          : error?.error?.error || 'Could not update the review. Please try again.';
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  getReviewArtworkImageUrl(review: ModerationArtworkReview): string {
    return this.drawingsService.getAdminReviewImageUrl(review.imagePath);
  }

  onReviewArtworkImageError(review: ModerationArtworkReview): void {
    this.reviewImageErrors[review.id] = true;
    this.cdr.markForCheck();
  }

  loadCustomDrawingRequests(showSuccessMessage = false): void {
    if (this.loadingDrawingRequests) return;
    this.loadingDrawingRequests = true;
    this.drawingRequestsMessage = '';
    this.drawingsService.getCustomDrawingRequests().pipe(timeout(30_000)).subscribe({
      next: requests => {
        this.customDrawingRequests = requests;
        this.drawingRequestPage = 1;
        this.customRequestImageErrors = {};
        this.loadingDrawingRequests = false;
        if (showSuccessMessage) this.drawingRequestsMessage = 'Drawing requests refreshed.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.loadingDrawingRequests = false;
        this.drawingRequestsMessage = this.getLoadErrorMessage(error, 'drawing requests');
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  onSketchFileSelected(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    this.selectedSketchFile = input.files?.[0] ?? null;
    this.sketchUploadMessage = '';
    this.sketchUploadSucceeded = false;
  }

  loadAdminDrawings(showSuccessMessage = false): void {
    if (this.loadingAdminDrawings) return;
    this.loadingAdminDrawings = true;
    this.adminDrawingsMessage = '';
    this.drawingsService.getAdminDrawings().pipe(timeout(30_000)).subscribe({
      next: drawings => {
        this.adminDrawings = drawings;
        this.loadingAdminDrawings = false;
        if (showSuccessMessage) this.adminDrawingsMessage = 'Uploaded sketches refreshed.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.loadingAdminDrawings = false;
        this.adminDrawingsMessage = this.getLoadErrorMessage(error, 'uploaded sketches');
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  deleteUploadedDrawing(drawing: AdminDrawing): void {
    if (this.deletingDrawingImage || !window.confirm(`Delete "${drawing.title}" from ${drawing.category}?`)) return;
    this.deletingDrawingImage = drawing.image;
    this.adminDrawingsMessage = '';
    this.drawingsService.deleteAdminDrawing(drawing.image).pipe(timeout(30_000)).subscribe({
      next: () => {
        this.adminDrawings = this.adminDrawings.filter(item => item.image !== drawing.image);
        this.deletingDrawingImage = null;
        this.adminDrawingsMessage = `"${drawing.title}" deleted.`;
        this.cdr.markForCheck();
      },
      error: error => {
        this.deletingDrawingImage = null;
        this.adminDrawingsMessage = error?.name === 'TimeoutError'
          ? 'Delete timed out. Refresh the list to check whether the sketch was deleted before retrying.'
          : error?.error?.error || 'Could not delete the sketch. Please try again.';
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  uploadSketch(): void {
    if (!this.selectedSketchFile || this.uploadingSketch) return;
    this.uploadingSketch = true;
    this.sketchUploadMessage = '';
    this.sketchUploadSucceeded = false;
    this.drawingsService.uploadSketch(this.selectedSketchFile, this.sketchCategory).pipe(timeout(60_000)).subscribe({
      next: response => {
        this.uploadingSketch = false;
        this.selectedSketchFile = null;
        if (this.sketchUploadInput) this.sketchUploadInput.nativeElement.value = '';
        this.sketchUploadSucceeded = true;
        this.sketchUploadMessage = `Sketch uploaded to ${response.category}.`;
        this.loadAdminDrawings();
        this.cdr.markForCheck();
      },
      error: error => {
        this.uploadingSketch = false;
        this.sketchUploadMessage = error?.name === 'TimeoutError'
          ? 'Upload timed out. Check the gallery before retrying to avoid uploading the same sketch twice.'
          : error?.error?.error || 'Could not upload the sketch. Please try again.';
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  onComicPageComicChanged(comicId: string): void {
    this.comicPagePartId = this.hindiComics.find(comic => comic.id === comicId)?.parts[0]?.id ?? '';
  }

  onComicPageFileSelected(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    this.selectedComicPageFile = input.files?.[0] ?? null;
    this.comicPageUploadMessage = '';
    this.comicPageUploadSucceeded = false;
  }

  uploadComicPage(): void {
    if (!this.selectedComicPageFile || !this.comicPageComicId || !this.comicPagePartId || this.uploadingComicPage) return;
    this.uploadingComicPage = true;
    this.comicPageUploadMessage = '';
    this.comicPageUploadSucceeded = false;
    this.drawingsService.uploadComicPage(
      this.selectedComicPageFile,
      this.comicPageComicId,
      this.comicPagePartId
    ).pipe(timeout(60_000)).subscribe({
      next: response => {
        this.uploadingComicPage = false;
        this.selectedComicPageFile = null;
        if (this.comicPageUploadInput) this.comicPageUploadInput.nativeElement.value = '';
        const comic = this.hindiComics.find(item => item.id === this.comicPageComicId);
        const part = this.selectedComicParts.find(item => item.id === this.comicPagePartId);
        this.comicPageUploadSucceeded = true;
        this.comicPageUploadMessage = `Page ${response.pageNumber} uploaded to ${comic?.title}, ${part?.title}. Upload the next page to add it after this one.`;
        this.cdr.markForCheck();
      },
      error: error => {
        this.uploadingComicPage = false;
        this.comicPageUploadMessage = error?.name === 'TimeoutError'
          ? 'Upload timed out. Check the comic before retrying to avoid uploading the same page twice.'
          : error?.error?.error || 'Could not upload the comic page. Please try again.';
        this.handleAdminAuthorizationError(error);
        this.cdr.markForCheck();
      }
    });
  }

  getCustomDrawingRequestImageUrl(request: CustomDrawingRequest): string {
    return this.drawingsService.getAdminCustomDrawingRequestImageUrl(request.id);
  }

  onCustomRequestImageError(request: CustomDrawingRequest): void {
    this.customRequestImageErrors[request.id] = true;
    this.cdr.markForCheck();
  }

  private getLoadErrorMessage(
    error: { name?: string; status?: number; error?: { error?: string } },
    resource: string
  ): string {
    if (error?.name === 'TimeoutError') {
      return `No response within 30 seconds while loading ${resource}. Please retry.`;
    }
    if (error?.error?.error) return error.error.error;
    if (error?.status === 0) return `Could not reach the server while loading ${resource}. Please retry.`;
    return `Could not load ${resource}. Please retry.`;
  }

  private handleAdminAuthorizationError(error: { status?: number }): void {
    if (error?.status === 401) {
      this.authenticated = false;
      this.message = 'Your admin session expired. Please sign in again.';
    }
  }

}
