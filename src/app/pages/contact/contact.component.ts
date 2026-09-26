import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <h1>Contact Us</h1>
      <p>Have questions about our artwork, commissions, or collaborations? We'd love to hear from you.</p>
      
      <div class="contact-details">
        <div class="detail-item">
          <strong>Email:</strong>
          <p><a href="mailto:hello@drawing.art">hello&#64;drawing.art</a></p>
        </div>
        
        <div class="detail-item">
          <strong>Social Media:</strong>
          <p>Follow us on Instagram and YouTube for behind-the-scenes content and process videos.</p>
        </div>
      </div>

      <section class="enquiry-form-note">
        <h2>Business Enquiries</h2>
        <p>For galleries, exhibitions, or commercial licensing of any drawings, please reach out via email with the subject line "Business Enquiry".</p>
      </section>

      <a routerLink="/" class="back-link">← Back to Home</a>
    </div>
  `,
  styles: [`
    .page-container { max-width: 800px; margin: 60px auto; padding: 0 20px; line-height: 1.8; color: #26342d; }
    h1 { font-family: Georgia, serif; font-size: 3rem; margin-bottom: 20px; }
    .contact-details { margin: 40px 0; }
    .detail-item { margin-bottom: 20px; }
    .detail-item a { color: #f08c76; text-decoration: none; font-size: 1.2rem; font-weight: bold; }
    .back-link { display: inline-block; margin-top: 40px; color: #f08c76; text-decoration: none; font-weight: bold; }
  `]
})
export class ContactComponent {}
