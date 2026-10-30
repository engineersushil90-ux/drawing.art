import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
          <label>Admin email<input name="email" type="email" autocomplete="username" [(ngModel)]="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required></label>
          <button type="submit" [disabled]="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
        </form>

        <p class="message" *ngIf="message" role="status">{{ message }}</p>

        <div *ngIf="authenticated" class="viewer-list">
          <p *ngIf="!viewers.length">No confirmed viewers yet.</p>
          <div class="table-wrap" *ngIf="viewers.length">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>First view</th><th>Last view</th><th>Views</th></tr></thead>
              <tbody><tr *ngFor="let viewer of viewers">
                <td>{{ viewer.name }}</td><td>{{ viewer.email }}</td>
                <td>{{ viewer.firstViewedAt | date:'medium' }}</td>
                <td>{{ viewer.lastViewedAt | date:'medium' }}</td><td>{{ viewer.views }}</td>
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
    .message{color:#9a3428}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}th,td{padding:12px;border-bottom:1px solid #e8e2d9;white-space:nowrap}th{font-weight:600}
  `]
})
export class AdminViewersComponent implements OnInit {
  private readonly drawingsService = inject(DrawingsService);
  email = '';
  password = '';
  busy = false;
  authenticated = false;
  message = '';
  viewers: AdultViewer[] = [];

  ngOnInit(): void {}

  login(): void {
    this.busy = true;
    this.message = '';
    this.drawingsService.adminLogin({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.authenticated = true;
        this.password = '';
        this.loadViewers();
      },
      error: () => this.message = 'Login failed. Check your credentials and server configuration.',
      complete: () => this.busy = false
    });
  }

  private loadViewers(): void {
    this.drawingsService.getAdultViewers().subscribe({
      next: viewers => this.viewers = viewers,
      error: () => { this.authenticated = false; this.message = 'Could not load the viewer list. Please sign in again.'; }
    });
  }
}
