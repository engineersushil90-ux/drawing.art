import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="policy-container">
      <h1>Privacy Policy</h1>
      <p>Last updated: {{ currentYear }}</p>
      
      <section>
        <h2>1. Information We Collect</h2>
        <p>We do not collect personal identification information from users. We may collect non-personal identification information about users whenever they interact with our site, such as browser name, type of computer, and technical information about users' means of connection to our site.</p>
      </section>

      <section>
        <h2>2. Google AdSense</h2>
        <p>We use Google AdSense to serve ads on our site. Google uses cookies to serve ads based on a user's prior visits to our website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to our users based on their visit to our sites and/or other sites on the Internet.</p>
      </section>

      <section>
        <h2>3. Third-Party Links</h2>
        <p>Our site may contain links to other websites. We are not responsible for the privacy practices or content of such third-party sites.</p>
      </section>

      <section>
        <h2>4. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at sushil&#64;smarttraffic.in</p>
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
    section { margin-bottom: 20px; }
    .back-link { display: inline-block; margin-top: 40px; color: #f08c76; text-decoration: none; font-weight: bold; }
  `]
})
export class PrivacyPolicyComponent {
  currentYear = new Date().getFullYear();
}
