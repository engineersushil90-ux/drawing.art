import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdultViewer, DrawingsService } from '../../core/services/drawings.service';

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
          <p class="login-hint" *ngIf="busy" role="status">The server may be waking up. Please wait; this can take up to 45 seconds.</p>
        </form>

        <p class="message" *ngIf="message" role="status">{{ message }}</p>

        <div *ngIf="authenticated" class="viewer-list">
          <section class="waiting-list">
            <div class="section-heading">
              <h2>Waiting for payment approval <span class="request-count">{{ pendingViewers.length }}</span></h2>
              <button type="button" class="refresh-button" (click)="loadViewers()">Refresh</button>
            </div>
            <p *ngIf="!pendingViewers.length">No payment requests waiting for approval.</p>
            <div class="table-wrap" *ngIf="pendingViewers.length">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Requested at</th><th>Approve payment</th></tr></thead>
                <tbody><tr *ngFor="let viewer of pendingViewers">
                  <td>{{ viewer.name }}</td><td>{{ viewer.email }}</td>
                  <td>{{ viewer.paymentRequestedAt | date:'medium' }}</td>
                <td>
                  <label class="paid-checkbox">
                    <input type="checkbox" [checked]="viewer.isPayment" [disabled]="paymentBusyEmail === viewer.email"
                      [attr.aria-label]="'Confirm payment received for ' + viewer.email" (change)="togglePayment(viewer, $event)">
                    <span>{{ paymentBusyEmail === viewer.email ? 'Saving…' : 'I received ₹20' }}</span>
                  </label>
                </td>
                </tr></tbody>
              </table>
            </div>
          </section>

          <h2>All viewers</h2>
          <p *ngIf="!viewers.length">No registered viewers yet.</p>
          <div class="table-wrap" *ngIf="viewers.length">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>First view</th><th>Last view</th><th>Views</th><th>Paid</th></tr></thead>
              <tbody><tr *ngFor="let viewer of viewers">
                <td>{{ viewer.name }}</td><td>{{ viewer.email }}</td>
                <td>{{ viewer.firstViewedAt | date:'medium' }}</td>
                <td>{{ viewer.lastViewedAt | date:'medium' }}</td><td>{{ viewer.views }}</td>
                <td>
                  <label class="paid-checkbox">
                    <input type="checkbox" [checked]="viewer.isPayment" [disabled]="paymentBusyEmail === viewer.email"
                      [attr.aria-label]="'Paid for ' + viewer.email" (change)="togglePayment(viewer, $event)">
                    <span>{{ paymentBusyEmail === viewer.email ? 'Saving…' : viewer.isPayment ? 'Paid' : 'Unpaid' }}</span>
                  </label>
                </td>
              </tr></tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;background:#f7f1e8;color:#26342d;font-family:Arial,sans-serif}
    .admin-page{max-width:1050px;margin:auto;padding:40px 24px}.back-link{color:inherit;text-decoration:none}
    .admin-card{margin:9vh auto 0;max-width:780px;background:#fffdf9;padding:clamp(24px,5vw,52px);border-radius:18px;box-shadow:0 16px 50px #26342d12}
    .eyebrow{text-transform:uppercase;letter-spacing:2px;font-size:12px;color:#9c6355}h1{font:42px Georgia,serif;margin:10px 0 28px}
    form{display:grid;gap:18px;max-width:430px}label{display:grid;gap:8px;font-size:14px}input{padding:13px;border:1px solid #d8d4cc;border-radius:8px;font:inherit}
    button{padding:13px 18px;border:0;border-radius:8px;background:#26342d;color:white;font:inherit;cursor:pointer}button:disabled{opacity:.6}
    .message{color:#9a3428}.login-hint{margin:0;color:#647069;font-size:13px;line-height:1.5}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}th,td{padding:12px;border-bottom:1px solid #e8e2d9;white-space:nowrap}th{font-weight:600}
    .viewer-list>h2,.section-heading h2{font:24px Georgia,serif}.waiting-list{margin-bottom:32px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-heading h2{display:flex;align-items:center;gap:10px}
    .request-count{display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:50%;background:#9c3428;color:white;font:14px Arial,sans-serif}.refresh-button{padding:8px 12px;font-size:13px}
    .paid-checkbox{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.paid-checkbox input{width:18px;height:18px;accent-color:#26342d}.paid-checkbox input:disabled{cursor:wait}
  `]
})
export class AdminViewersComponent implements OnInit, OnDestroy {
  private readonly drawingsService = inject(DrawingsService);
  username = '';
  password = '';
  busy = false;
  authenticated = false;
  message = '';
  viewers: AdultViewer[] = [];
  paymentBusyEmail = '';
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  get pendingViewers(): AdultViewer[] {
    return this.viewers.filter(viewer => !viewer.isPayment && Boolean(viewer.paymentRequestedAt));
  }

  ngOnInit(): void {
    this.refreshTimer = setInterval(() => {
      if (this.authenticated && !this.paymentBusyEmail) this.loadViewers();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  login(): void {
    this.busy = true;
    this.message = '';
    this.drawingsService.adminLogin({ username: this.username.trim(), password: this.password }).subscribe({
      next: () => {
        this.busy = false;
        this.authenticated = true;
        this.password = '';
        this.loadViewers();
      },
      error: error => {
        this.busy = false;
        this.message = error?.error?.error
          || (error?.name === 'TimeoutError'
            ? 'Login timed out after 45 seconds. Check that Render and Supabase are available, then try again.'
            : 'Login failed. Check your credentials and server configuration.');
      }
    });
  }

  loadViewers(): void {
    this.drawingsService.getAdultViewers().subscribe({
      next: viewers => this.viewers = viewers,
      error: () => { this.authenticated = false; this.message = 'Could not load the viewer list. Please sign in again.'; }
    });
  }

  togglePayment(viewer: AdultViewer, event: Event): void {
    if (this.paymentBusyEmail) return;
    const isPayment = (event.target as HTMLInputElement).checked;
    this.paymentBusyEmail = viewer.email;
    this.message = '';
    this.drawingsService.setAdultViewerPayment(viewer.email, isPayment).subscribe({
      next: response => {
        viewer.isPayment = response.isPayment;
        viewer.paymentRequestedAt = null;
        this.paymentBusyEmail = '';
        this.message = `${viewer.email} is now marked ${response.isPayment ? 'paid' : 'unpaid'}.`;
      },
      error: error => {
        this.paymentBusyEmail = '';
        this.message = error?.error?.error || 'Could not update payment status. Please try again.';
      }
    });
  }
}
