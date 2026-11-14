import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DrawingsService } from '../../core/services/drawings.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page-container">
      <h1>Contact Us</h1>
      <p>Have questions about our artwork, commissions, or collaborations? We'd love to hear from you.</p>

      <section class="request-card" aria-labelledby="request-title">
        <p class="eyebrow">Commission request</p>
        <h2 id="request-title">Request a custom drawing</h2>
        <p>Tell us what you have in mind. You can attach one JPG, PNG, or WebP reference image (up to 5 MB).</p>

        <form (ngSubmit)="submitRequest()" #requestForm="ngForm" novalidate>
          <label>
            Your name
            <input name="name" type="text" [(ngModel)]="request.name" maxlength="80" autocomplete="name" required>
          </label>
          <label>
            Email address
            <input name="email" type="email" [(ngModel)]="request.email" maxlength="254" autocomplete="email" required>
          </label>
          <label>
            What would you like drawn?
            <textarea
              name="description"
              [(ngModel)]="request.description"
              minlength="15"
              maxlength="2000"
              rows="5"
              aria-describedby="description-help"
              required
            ></textarea>
            <small id="description-help" class="field-help">
              Describe the drawing in at least 15 characters ({{ request.description.trim().length }}/15).
            </small>
          </label>
          <label>
            Reference image (optional)
            <input
              #referenceInput
              type="file"
              accept="image/jpeg,image/png,image/webp"
              (change)="onReferenceSelected($event)"
            >
          </label>
          <div class="reference-preview" *ngIf="referencePreviewUrl">
            <img [src]="referencePreviewUrl" alt="Selected reference image preview">
            <div>
              <span>{{ referenceImage?.name }}</span>
              <button type="button" class="remove-image" (click)="clearReferenceImage(referenceInput)">Remove image</button>
            </div>
          </div>

          <div class="honeypot" aria-hidden="true">
            <label>Leave this field empty<input name="website" type="text" [(ngModel)]="request.website" tabindex="-1" autocomplete="off"></label>
          </div>

          <button type="submit" [disabled]="requestForm.invalid || submitting">
            {{ submitting ? 'Sending request…' : 'Send drawing request' }}
          </button>
          <p class="form-message" [class.error]="requestError" *ngIf="requestMessage" role="status">{{ requestMessage }}</p>
        </form>
      </section>

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
    .request-card { margin: 36px 0 48px; padding: clamp(22px, 5vw, 40px); border: 1px solid #e8e2d9; border-radius: 18px; background: #fffdf9; box-shadow: 0 16px 42px #26342d0d; }
    .request-card h2 { margin: 0; font: 2rem Georgia, serif; }
    .eyebrow { margin: 0 0 8px; color: #9c6355; font-size: .75rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
    .request-card form { display: grid; gap: 16px; margin-top: 24px; }
    .request-card label { display: grid; gap: 6px; font-size: .95rem; font-weight: 600; }
    .request-card input, .request-card textarea { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #d8d4cc; border-radius: 8px; color: inherit; font: inherit; }
    .request-card input[type=file] { padding: 9px; background: #fff; }
    .request-card textarea { resize: vertical; }
    .field-help { color: #647069; font-size: .8rem; font-weight: 400; }
    .request-card button { justify-self: start; padding: 13px 20px; border: 0; border-radius: 8px; background: #26342d; color: #fff; font: inherit; cursor: pointer; }
    .request-card button:disabled { opacity: .6; cursor: wait; }
    .reference-preview { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 10px; background: #f7f1e8; }
    .reference-preview img { width: 84px; height: 84px; border-radius: 6px; object-fit: cover; }
    .reference-preview div { display: grid; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
    .request-card .remove-image { padding: 0; background: transparent; color: #8c3d31; text-align: left; }
    .form-message { margin: 0; color: #286343; }
    .form-message.error { color: #9a3428; }
    .honeypot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
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
    @media (max-width: 600px) { .page-container { margin-top: 36px; } h1 { font-size: 2.4rem; } .reference-preview { align-items: flex-start; } }
  `]
})
export class ContactComponent implements OnDestroy {
  private readonly drawingsService = inject(DrawingsService);
  referencePreviewUrl?: string;
  request = { name: '', email: '', description: '', website: '' };
  referenceImage?: File;
  submitting = false;
  requestError = false;
  requestMessage = '';

  ngOnDestroy(): void {
    this.revokeReferencePreview();
  }

  onReferenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.requestMessage = '';
    this.requestError = false;

    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      input.value = '';
      this.clearReferenceImage();
      this.showError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      input.value = '';
      this.clearReferenceImage();
      this.showError('The reference image must be 5 MB or smaller.');
      return;
    }

    this.clearReferenceImage();
    this.referenceImage = file;
    this.referencePreviewUrl = URL.createObjectURL(file);
  }

  clearReferenceImage(input?: HTMLInputElement): void {
    if (input) input.value = '';
    this.revokeReferencePreview();
    this.referenceImage = undefined;
  }

  submitRequest(): void {
    if (this.submitting) return;
    this.submitting = true;
    this.requestMessage = '';
    this.requestError = false;
    this.drawingsService.submitCustomDrawingRequest(this.request, this.referenceImage).subscribe({
      next: () => {
        this.request = { name: '', email: '', description: '', website: '' };
        this.clearReferenceImage();
        this.requestMessage = 'Your drawing request was sent. We will contact you by email.';
        this.submitting = false;
      },
      error: error => {
        this.showError(error?.error?.error || 'Could not send your request. Please try again or email us directly.');
        this.submitting = false;
      }
    });
  }

  private showError(message: string): void {
    this.requestError = true;
    this.requestMessage = message;
  }

  private revokeReferencePreview(): void {
    if (this.referencePreviewUrl) URL.revokeObjectURL(this.referencePreviewUrl);
    this.referencePreviewUrl = undefined;
  }
}
