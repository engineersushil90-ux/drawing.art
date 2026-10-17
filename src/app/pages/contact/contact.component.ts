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
          <p>
            <a class="contact-action" href="mailto:sushil@smarttraffic.in">
              <svg class="contact-icon mail-icon" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              sushil&#64;smarttraffic.in
            </a>
          </p>
        </div>
        
        <div class="detail-item">
          <strong>Social Media:</strong>
          <p>Follow us on Instagram and YouTube for behind-the-scenes content and process videos.</p>
          <div class="social-links" aria-label="Social media links">
            <a href="https://www.instagram.com/drawing.art90?utm_source=ig_web_button_share_sheet&amp;xtok=ZDNlZDc0MzIxNw=="
               target="_blank" rel="noopener noreferrer" aria-label="Open Drawing Art on Instagram">
              <svg class="social-icon instagram-icon" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle class="icon-dot" cx="17.5" cy="6.8" r="1" />
              </svg>
              Instagram
            </a>
            <a href="https://youtube.com/shorts/NqTsNps1hxo?si=-B49tGL3Nv_9AHqJ"
               target="_blank" rel="noopener noreferrer" aria-label="Open Drawing Art on YouTube">
              <svg class="social-icon youtube-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path class="youtube-mark" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z" />
                <path class="play-mark" d="m9.6 15.6 6.2-3.6-6.2-3.6v7.2Z" />
              </svg>
              YouTube
            </a>
          </div>
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
    .contact-action { display: inline-flex; align-items: center; gap: 10px; }
    .contact-icon { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .social-links { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 18px; }
    .social-links a { display: inline-flex; align-items: center; gap: 9px; padding: 10px 15px; border: 1px solid #e3dfd7; border-radius: 999px; color: #26342d; font-size: 1rem; transition: background .2s ease, transform .2s ease; }
    .social-links a:hover { background: #fff; transform: translateY(-2px); }
    .social-icon { width: 22px; height: 22px; flex: 0 0 22px; }
    .instagram-icon { fill: none; stroke: #d64a78; stroke-width: 1.8; }
    .instagram-icon .icon-dot { fill: #d64a78; stroke: none; }
    .youtube-mark { fill: #f00; }
    .play-mark { fill: #fff; }
    .back-link { display: inline-block; margin-top: 40px; color: #f08c76; text-decoration: none; font-weight: bold; }
  `]
})
export class ContactComponent {}
