import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AdultViewer,
  DrawingsService,
  ModerationArtworkReview
} from '../../core/services/drawings.service';

@Component({
  selector: 'app-admin-viewers',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <main class="admin-page">
      <a routerLink="/" class="back-link">← drawing.art</a>
      <section class="admin-card">
        <p class="eyebrow">Owner access</p>
        <h1>18+ Sketches viewers</h1>

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
            <button type="button" class="refresh-button" [disabled]="loadingViewers" (click)="loadViewers()">
              {{ loadingViewers ? 'Loading…' : 'Refresh' }}
            </button>
          </div>

          <p *ngIf="loadingViewers" role="status">Loading viewer list…</p>
          <p *ngIf="!loadingViewers && !viewers.length">No registered viewers yet.</p>

          <div class="table-wrap" *ngIf="!loadingViewers && viewers.length">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Last viewed</th><th>Views</th></tr></thead>
              <tbody><tr *ngFor="let viewer of viewers">
                <td>{{ viewer.name }}</td>
                <td>{{ viewer.email }}</td>
                <td>{{ viewer.lastViewedAt | date:'medium' }}</td>
                <td>{{ viewer.views }}</td>
              </tr></tbody>
            </table>
          </div>
        </div>

        <section *ngIf="authenticated" class="review-moderation" aria-labelledby="review-moderation-title">
          <div class="list-heading">
            <div>
              <h2 id="review-moderation-title">Review moderation</h2>
              <p class="description">Pending reviews: <strong>{{ pendingReviews.length | number }}</strong></p>
            </div>
            <button type="button" class="refresh-button" [disabled]="loadingReviews" (click)="loadPendingReviews()">
              {{ loadingReviews ? 'Loading…' : 'Refresh reviews' }}
            </button>
          </div>

          <p *ngIf="reviewsMessage" class="message" role="status">{{ reviewsMessage }}</p>
          <p *ngIf="loadingReviews" role="status">Loading pending reviews…</p>
          <p *ngIf="!loadingReviews && !pendingReviews.length">No reviews awaiting moderation.</p>

          <article class="moderation-review" *ngFor="let review of pendingReviews">
            <div class="moderation-review-heading">
              <strong>{{ review.name }}</strong>
              <span>{{ review.rating }} / 5</span>
              <time [attr.datetime]="review.createdAt">{{ review.createdAt | date:'medium' }}</time>
            </div>
            <p class="review-image">{{ review.imagePath }}</p>
            <p class="moderation-comment">{{ review.comment }}</p>
            <div class="moderation-actions">
              <button
                type="button"
                [disabled]="moderatingReviewId === review.id"
                (click)="moderateReview(review, 'approved')"
              >Approve</button>
              <button
                type="button"
                class="reject-button"
                [disabled]="moderatingReviewId === review.id"
                (click)="moderateReview(review, 'rejected')"
              >Reject</button>
            </div>
          </article>
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
    button:disabled{opacity:.6;cursor:wait}.message{color:#9a3428}
    .login-hint,.privacy-note{margin:0;color:#647069;font-size:13px;line-height:1.5}
    .list-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:12px 0 20px}
    .description{margin:0 0 4px;color:#647069}.description strong{color:#26342d}
    .refresh-button{padding:9px 14px}.table-wrap{overflow:auto}
    table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}
    th,td{padding:12px;border-bottom:1px solid #e8e2d9;white-space:nowrap}th{font-weight:600}
    .review-moderation{margin-top:42px;padding-top:30px;border-top:1px solid #e8e2d9}
    .review-moderation h2{margin:0 0 8px;font:26px Georgia,serif}
    .moderation-review{padding:18px 0;border-bottom:1px solid #e8e2d9}
    .moderation-review-heading{display:flex;flex-wrap:wrap;gap:14px;align-items:baseline}
    .moderation-review-heading time,.review-image{color:#647069;font-size:12px}
    .review-image{overflow-wrap:anywhere}
    .moderation-comment{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}
    .moderation-actions{display:flex;gap:10px}
    .reject-button{background:#8c3d31}
    @media(max-width:600px){.admin-page{padding:24px 16px}.admin-card{margin-top:7vh}h1{font-size:34px}.list-heading{align-items:flex-start}}
  `]
})
export class AdminViewersComponent implements OnDestroy {
  private readonly drawingsService = inject(DrawingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private loginDeadline: ReturnType<typeof setTimeout> | undefined;
  private loginSubscription: Subscription | undefined;
  username = '';
  password = '';
  busy = false;
  authenticated = false;
  loadingViewers = false;
  message = '';
  viewers: AdultViewer[] = [];
  pendingReviews: ModerationArtworkReview[] = [];
  loadingReviews = false;
  moderatingReviewId: string | null = null;
  reviewsMessage = '';

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
        this.loadViewers();
        this.loadPendingReviews();
      },
      error: error => {
        this.clearLoginDeadline();
        this.loginSubscription = undefined;
        this.busy = false;
        this.message = this.getLoginErrorMessage(error);
      }
    });
  }

  private clearLoginDeadline(): void {
    if (this.loginDeadline) clearTimeout(this.loginDeadline);
    this.loginDeadline = undefined;
  }

  private getLoginErrorMessage(error: { error?: { error?: string }; name?: string; status?: number }): string {
    if (error?.error?.error) return error.error.error;
    if (error?.name === 'TimeoutError') return 'Login timed out after 30 seconds. Check Render and Supabase availability, then retry.';
    if (error?.status === 401) return 'Username or password is incorrect.';
    if (error?.status === 0) return 'Could not reach the API server. It may be waking up, or the network/CORS request failed. Please retry.';
    if (error?.status === 503) return 'The login service or database is unavailable. Check the Render server logs and Supabase connection.';
    return 'Login failed' + (error?.status ? ` (HTTP ${error.status})` : '') + '. Please retry or check the Render server logs.';
  }

  loadViewers(): void {
    if (this.loadingViewers) return;
    this.loadingViewers = true;
    this.message = '';
    this.drawingsService.getAdultViewers().subscribe({
      next: viewers => {
        this.viewers = viewers;
        this.loadingViewers = false;
      },
      error: error => {
        this.loadingViewers = false;
        this.message = error?.error?.error || 'Could not load the viewer list. Please sign in again.';
        this.authenticated = false;
      }
    });
  }

  loadPendingReviews(): void {
    if (this.loadingReviews) return;
    this.loadingReviews = true;
    this.reviewsMessage = '';
    this.drawingsService.getPendingArtworkReviews().subscribe({
      next: reviews => {
        this.pendingReviews = reviews;
        this.loadingReviews = false;
      },
      error: error => {
        this.loadingReviews = false;
        this.reviewsMessage = error?.error?.error || 'Could not load pending reviews. Please sign in again.';
        if (error?.status === 401) this.authenticated = false;
      }
    });
  }

  moderateReview(review: ModerationArtworkReview, status: 'approved' | 'rejected'): void {
    if (this.moderatingReviewId) return;
    this.moderatingReviewId = review.id;
    this.reviewsMessage = '';
    this.drawingsService.moderateArtworkReview(review.id, status).subscribe({
      next: () => {
        this.pendingReviews = this.pendingReviews.filter(item => item.id !== review.id);
        this.moderatingReviewId = null;
        this.reviewsMessage = status === 'approved'
          ? 'Review approved and published.'
          : 'Review rejected.';
      },
      error: error => {
        this.moderatingReviewId = null;
        this.reviewsMessage = error?.error?.error || 'Could not update the review. Please try again.';
        if (error?.status === 401) this.authenticated = false;
      }
    });
  }
}
