import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="policy-container">
      <h1>Terms of Service</h1>
      <p>Last updated: {{ currentYear }}</p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using drawing.art, you accept and agree to be bound by the terms and provision of this agreement.</p>
      </section>

      <section>
        <h2>2. Content</h2>
        <p>All drawings and content on this site are for personal enjoyment. Commercial use of the artwork without permission is prohibited.</p>
      </section>

      <section>
        <h2>3. Use of Site</h2>
        <p>You agree to use the site only for lawful purposes and in a way that does not infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the site.</p>
      </section>

      <a routerLink="/" class="back-link">← Back to Home</a>
    </div>
  `,
  styles: [`
    .policy-container {
      max-width: 800px;
      margin: 60px auto;
      padding: 0 20px;
      line-height: 1.6;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
    }
    h1 { font-size: 2.5rem; margin-bottom: 30px; }
    h2 { font-size: 1.5rem; margin-top: 30px; }
    .back-link { display: inline-block; margin-top: 40px; color: #f08c76; text-decoration: none; font-weight: bold; }
  `]
})
export class TermsOfServiceComponent {
  currentYear = new Date().getFullYear();
}
