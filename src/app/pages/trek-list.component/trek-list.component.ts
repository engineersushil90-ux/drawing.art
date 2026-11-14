import {
  Component,
  OnInit,
  inject,
  afterNextRender,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  DrawingsService,
  Artwork,
  normalizeImagePath
} from '../../core/services/drawings.service';


@Component({
  selector: 'app-drawing-art',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './trek-list.component.html',
  styleUrl: './trek-list.component.scss'
})
export class DrawingArtComponent implements OnInit {

  // --------------------------------------------------
  // BASIC PAGE DATA
  // --------------------------------------------------

  readonly currentYear = new Date().getFullYear();


  readonly categories = [
    'All Drawings',
    'Pencil Sketches',
    '18+ Sketches',
    'Color Art'
  ];


  activeCategory = 'All Drawings';


  // --------------------------------------------------
  // UI STATE
  // --------------------------------------------------

  selectedArtwork: Artwork | null = null;

  isMenuOpen = false;

  isLoading = true;

  adultAccessOpen = false;
  adultAccessBusy = false;
  adultAccessError = '';
  adultName = '';
  adultEmail = '';
  isAdultConfirmed = false;
  adultImageAccessToken = '';
  isPayment = false;
  readonly adultPaymentRequired = false;
  private adultAccessConfirmedThisSession = false;
  paymentInfoOpen = false;
  paymentRequestBusy = false;
  paymentRequestMessage = '';
  readonly adultPaymentUpiId = 'kanchan.sushil90-1@oksbi';
  readonly adultUpiPaymentUrl = `upi://pay?pa=${encodeURIComponent(this.adultPaymentUpiId)}&pn=Kanchan&am=20&cu=INR&tn=${encodeURIComponent('18+ Sketches')}`;
  paymentCopyMessage = '';


  // --------------------------------------------------
  // DRAWINGS
  // --------------------------------------------------

  artworks: Artwork[] = [];

  get totalArtworkCount(): number {
    return this.artworks.filter(
      artwork => artwork.category !== 'Feature Drawing'
    ).length;
  }

  get pencilSketchCount(): number {
    return this.artworks.filter(
      artwork => artwork.category === 'Pencil Sketches'
    ).length;
  }

  get adultSketchCount(): number {
    return this.artworks.filter(
      artwork => artwork.category === '18+ Sketches'
    ).length;
  }

  get colorArtCount(): number {
    return this.artworks.filter(
      artwork => artwork.category === 'Color Art'
    ).length;
  }


  // --------------------------------------------------
  // LIKES
  // --------------------------------------------------

  likes: Record<string, number> = {};

  get totalLikes(): number {
    return Object.values(this.likes).reduce(
      (total, count) => total + (Number(count) || 0),
      0
    );
  }


  // --------------------------------------------------
  // VISITS
  // --------------------------------------------------

  visits = 0;

  todayLikes = 0;

  todayVisits = 0;


  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  readonly pageSize = 15;

  currentPage = 1;


  // --------------------------------------------------
  // SERVICES
  // --------------------------------------------------

private readonly drawingsService =
  inject(DrawingsService);

private readonly cdr =
  inject(ChangeDetectorRef);


  // --------------------------------------------------
  // RECORD VISIT
  // --------------------------------------------------
  //
  // afterNextRender runs only after Angular has finished
  // rendering the page in the browser.
  //
  // This avoids the hydration/change-detection error.
  //

  private readonly visitTracker = afterNextRender(() => {
    this.recordVisit();
    this.completeAdultEmailLink();
  });


  // --------------------------------------------------
  // FEATURE DRAWING
  // --------------------------------------------------
  //Update
  // Finds the drawing coming from the FeatureDrawing folder.
  //

  get featuredArtwork(): Artwork | null {

    return this.artworks.find(
      artwork =>
        artwork.category === 'Feature Drawing'
    ) ?? null;

  }

  getArtworkImage(artwork: Artwork): string {
    if (artwork.category !== '18+ Sketches' || !this.adultImageAccessToken) {
      return artwork.image;
    }

    const separator = artwork.image.includes('?') ? '&' : '?';
    return `${artwork.image}${separator}access_token=${encodeURIComponent(this.adultImageAccessToken)}`;
  }


  // --------------------------------------------------
  // FILTERED DRAWINGS
  // --------------------------------------------------
  // All Drawings:
  //   - Pencil Sketches
  //   - Color Art
  //
  // Excluded:
  //   - 18+ Sketches
  //   - Feature Drawing
  //
  // Other tabs show only their own category.
  //

  get filteredArtworks(): Artwork[] {

    let filtered: Artwork[];

    if (this.activeCategory === 'All Drawings') {

      filtered = this.artworks.filter(
        artwork =>
          artwork.category !== '18+ Sketches' &&
          artwork.category !== 'Feature Drawing'
      );

    } else {
      filtered = this.artworks.filter(
        artwork => artwork.category === this.activeCategory
      );
    }

    return filtered.sort((a, b) => {
      const recency = (artwork: Artwork): number => Math.max(
        Date.parse(`${artwork.date || ''}T00:00:00.000Z`) || 0,
        Date.parse(artwork.modifiedAt || '') || 0,
        Date.parse(artwork.addedAt || '') || 0
      );

      const recencyOrder = recency(b) - recency(a);

      if (recencyOrder !== 0) {
        return recencyOrder;
      }

      return (b.date || '').localeCompare(a.date || '');
    });

  }


  // --------------------------------------------------
  // CURRENT PAGE DRAWINGS
  // --------------------------------------------------

  get visibleArtworks(): Artwork[] {

    const start =
      (this.currentPage - 1) * this.pageSize;

    const end =
      start + this.pageSize;


    return this.filteredArtworks.slice(
      start,
      end
    );

  }


  // --------------------------------------------------
  // TOTAL PAGES
  // --------------------------------------------------

  get totalPages(): number {

    return Math.ceil(
      this.filteredArtworks.length /
      this.pageSize
    );

  }


  // --------------------------------------------------
  // PAGE NUMBERS
  // --------------------------------------------------

  get pageNumbers(): number[] {

    return Array.from(
      {
        length: this.totalPages
      },
      (_, index) => index + 1
    );

  }


  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------

  ngOnInit(): void {

    this.loadDrawings(this.adultImageAccessToken);

    this.loadLikes();

    this.loadTodayActivity();

  }


  // --------------------------------------------------
  // LOAD DRAWINGS
  // --------------------------------------------------
loadDrawings(imageAccessToken = ''): void {
  this.isLoading = true;

  console.log('Loading drawings.json...');

  this.drawingsService
    .getDrawings(imageAccessToken)
    .subscribe({
      next: drawings => {
        console.log(
          'DRAWINGS LOADED:',
          drawings
        );

        this.artworks = drawings;
        const adultDrawing = drawings.find(artwork => artwork.category === '18+ Sketches');
        if (adultDrawing) this.isPayment = adultDrawing.isPayment ?? this.isPayment;
        this.isLoading = false;

        // Force UI refresh
        this.cdr.detectChanges();
      },

      error: error => {
        console.error(
          'DRAWINGS ERROR:',
          error
        );

        this.artworks = [];
        this.isLoading = false;

        // Force UI refresh
        this.cdr.detectChanges();
      }
    });
}

  // --------------------------------------------------
  // LOAD LIKES
  // --------------------------------------------------

  loadLikes(): void {
  this.drawingsService
    .getLikes()
    .subscribe({
      next: likes => {
        this.likes = likes;

        console.log(
          'Likes loaded:',
          likes
        );

        this.cdr.detectChanges();
      },

      error: error => {
        console.error(
          'Failed to load likes:',
          error
        );

        this.likes = {};

        this.cdr.detectChanges();
      }
    });
}

  loadTodayActivity(): void {
    this.drawingsService
      .getTodayActivity()
      .subscribe({
        next: activity => {
          this.todayLikes = activity.likes;
          this.todayVisits = activity.visits;
          this.cdr.detectChanges();
        },
        error: error => {
          console.error('Failed to load today activity:', error);
        }
      });
  }

  // --------------------------------------------------
  // LIKE DRAWING
  // --------------------------------------------------

  likeDrawing(
    event: MouseEvent,
    artwork: Artwork
  ): void {

    // Prevent clicking Like from opening
    // the artwork lightbox.

    event.stopPropagation();


    this.drawingsService
      .likeDrawing(artwork.image, artwork.category)
      .subscribe({

        next: response => {

          this.likes[response.image] =
            response.likes;

          this.loadTodayActivity();

          this.cdr.detectChanges();


          console.log(
            'Like updated:',
            response
          );

        },


        error: error => {

          console.error(
            'Failed to like drawing:',
            error
          );

          this.cdr.detectChanges();

        }

      });

  }

  getLikeCount(artwork: Artwork): number {
    return this.likes[normalizeImagePath(artwork.image, artwork.category)] || 0;
  }


  // --------------------------------------------------
  // RECORD SITE VISIT
  // --------------------------------------------------

  recordVisit(): void {
  this.drawingsService
    .recordVisit()
    .subscribe({
      next: response => {
        this.visits =
          response.visits;

        this.loadTodayActivity();

        console.log(
          'Total site visits:',
          this.visits
        );

        this.cdr.detectChanges();
      },

      error: error => {
        console.error(
          'Failed to record visit:',
          error
        );

        this.cdr.detectChanges();
      }
    });
}


  // --------------------------------------------------
  // CATEGORY
  // --------------------------------------------------

  selectCategory(
    category: string
  ): void {

    if (category === '18+ Sketches') {
      if (this.hasAdultAccessForCurrentSession()) {
        this.activeCategory = category;
        this.currentPage = 1;
        this.loadDrawings(this.adultImageAccessToken);
        return;
      }
      this.adultAccessError = '';
      this.adultAccessOpen = true;
      return;
    }

    this.activeCategory =
      category;


    // Always start from page 1
    // when changing category.

    this.currentPage = 1;

  }

  confirmAdultAccess(): void {
    if (!this.isAdultConfirmed || this.adultAccessBusy) return;
    this.adultAccessBusy = true;
    this.adultAccessError = '';
    const viewerDetails = {
      name: this.adultName.trim(),
      email: this.adultEmail.trim().toLowerCase(),
      isAdult: this.isAdultConfirmed
    };
    this.drawingsService.registerAdultViewer(viewerDetails).subscribe({
      next: response => this.finishAdultAccess(response),
      error: error => {
        this.adultAccessBusy = false;
        this.adultAccessError = error?.error?.error || 'Your details could not be saved. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  private completeAdultEmailLink(): void {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const linkError = params.get('error_description');
    if (!accessToken && !linkError) return;

    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    this.adultAccessOpen = true;

    let pendingDetails: { name: string; email: string; isAdult: boolean } | null = null;
    try {
      const saved = localStorage.getItem('pendingAdultEmailVerification');
      pendingDetails = saved ? JSON.parse(saved) as { name: string; email: string; isAdult: boolean } : null;
    } catch {
      pendingDetails = null;
    }

    if (linkError) {
      this.adultAccessError = 'That email link expired or was already used. Request a new email and open the latest link.';
      this.cdr.detectChanges();
      return;
    }
    if (!accessToken || !pendingDetails?.name || !pendingDetails.email || !pendingDetails.isAdult) {
      this.adultAccessError = 'Email link state was not found. Start again in this browser and open the new email link here.';
      this.cdr.detectChanges();
      return;
    }

    this.adultAccessBusy = true;
    this.adultAccessError = '';
    this.drawingsService.verifyAdultEmailLink({
      ...pendingDetails,
      accessToken
    }).subscribe({
      next: response => this.finishAdultAccess(response),
      error: error => {
        localStorage.removeItem('pendingAdultEmailVerification');
        this.adultAccessBusy = false;
        this.adultAccessError = error?.error?.error || 'Email link could not be verified. Request a new link.';
        this.cdr.detectChanges();
      }
    });
  }

  private finishAdultAccess(response: { imageAccessToken: string; isPayment: boolean }): void {
    if (!response.imageAccessToken) {
      this.adultAccessBusy = false;
      this.adultAccessError = 'Gallery access could not be set up. Please try again.';
      this.cdr.detectChanges();
      return;
    }
    this.isPayment = response.isPayment;
    this.rememberAdultAccessForCurrentSession(response.imageAccessToken);
    this.adultAccessOpen = false;
    this.adultAccessBusy = false;
    this.activeCategory = '18+ Sketches';
    this.currentPage = 1;
    this.loadDrawings(this.adultImageAccessToken);
    this.cdr.detectChanges();
  }

  async copyAdultPaymentUpiId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.adultPaymentUpiId);
      this.paymentCopyMessage = 'UPI ID copied.';
    } catch {
      this.paymentCopyMessage = 'Copy failed. Select and copy the UPI ID above.';
    }
  }

  closePaymentInfo(): void {
    if (this.paymentRequestBusy) return;
    if (this.isPayment) {
      this.paymentInfoOpen = false;
      return;
    }
    if (!window.confirm('Kya aapne ₹20 payment kar diya? Yes par payment approval ke liye admin ko request jayegi.')) {
      this.paymentInfoOpen = false;
      return;
    }
    if (!this.adultImageAccessToken) {
      this.paymentRequestMessage = 'Payment request nahi bheji ja saki. 18+ gallery dobara kholkar try karein.';
      this.paymentInfoOpen = false;
      return;
    }

    this.paymentRequestBusy = true;
    this.paymentRequestMessage = '';
    this.drawingsService.requestAdultPaymentApproval(this.adultImageAccessToken).subscribe({
      next: () => {
        this.paymentRequestBusy = false;
        this.paymentInfoOpen = false;
        this.paymentRequestMessage = 'Payment reported. Access will unlock after admin approval.';
        this.cdr.detectChanges();
      },
      error: error => {
        this.paymentRequestBusy = false;
        this.paymentRequestMessage = error?.error?.error || 'Payment request could not be sent. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  isLockedArtwork(artwork: Artwork): boolean {
    return this.adultPaymentRequired
      && artwork.category === '18+ Sketches'
      && !artwork.isFreePreview
      && !this.isPayment;
  }

  private hasAdultAccessForCurrentSession(): boolean {
    if (this.adultAccessConfirmedThisSession && this.adultImageAccessToken) return true;
    try {
      this.adultImageAccessToken = localStorage.getItem('adultSketchImageAccessToken')
        || sessionStorage.getItem('adultSketchImageAccessToken')
        || '';
      this.adultAccessConfirmedThisSession = Boolean(this.adultImageAccessToken);
    } catch {
      return false;
    }
    return this.adultAccessConfirmedThisSession;
  }

  private rememberAdultAccessForCurrentSession(imageAccessToken: string): void {
    this.adultImageAccessToken = imageAccessToken;
    this.adultAccessConfirmedThisSession = true;
    try {
      localStorage.setItem('adultSketchImageAccessToken', imageAccessToken);
      sessionStorage.removeItem('adultSketchImageAccessToken');
    } catch {
      // Keep the confirmation in memory if browser storage is unavailable.
    }
  }


  // --------------------------------------------------
  // PAGINATION 
  // --------------------------------------------------

  goToPage(
    page: number
  ): void {

    if (
      page < 1 ||
      page > this.totalPages
    ) {

      return;

    }

    this.currentPage = page;
  }


  // --------------------------------------------------
  // NEXT PAGE
  // --------------------------------------------------

  nextPage(): void {

    if (
      this.currentPage <
      this.totalPages
    ) {

      this.goToPage(
        this.currentPage + 1
      );

    }

  }


  // --------------------------------------------------
  // PREVIOUS PAGE
  // --------------------------------------------------

  previousPage(): void {

    if (
      this.currentPage > 1
    ) {

      this.goToPage(
        this.currentPage - 1
      );

    }

  }


  // --------------------------------------------------
  // LIGHTBOX
  // --------------------------------------------------

  openArtwork(
    artwork: Artwork
  ): void {

    if (this.isLockedArtwork(artwork)) {
      this.paymentInfoOpen = true;
      return;
    }

    this.selectedArtwork =
      artwork;

  }


  // --------------------------------------------------
  // CLOSE LIGHTBOX
  // --------------------------------------------------

  closeArtwork(): void {

    this.selectedArtwork =
      null;

  }

}
