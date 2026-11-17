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
  ArtworkReview,
  normalizeImagePath
} from '../../core/services/drawings.service';
import { getFirstNewComicTarget, hasNewComicContent } from '../hindi-comics/hindi-comics.data';


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

  readonly affiliateLinks: Array<{ label: string; url: string }> = [
    { label: 'Amazon pick 1', url: 'https://link.amazon/B0fJLrWQn' },
    { label: 'Amazon pick 2', url: 'https://link.amazon/B0aiAVdOC' },
    { label: 'Amazon pick 3', url: 'https://link.amazon/B00KuDa73' },
    { label: 'Amazon pick 4', url: 'https://link.amazon/B06OCJu6p' }
  ];

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
  reviewArtwork: Artwork | null = null;
  artworkReviews: ArtworkReview[] = [];
  artworkReviewCounts: Record<string, number> = {};
  reviewCountsLoaded = false;
  reviewCountsMessage = '';
  reviewsLoading = false;
  reviewSubmitting = false;
  reviewName = '';
  reviewRating = 5;
  reviewComment = '';
  reviewWebsite = '';
  reviewMessage = '';

  isMenuOpen = false;
  readonly newHindiComicTarget = getFirstNewComicTarget();
  readonly hasNewHindiComics = hasNewComicContent();

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
  todayLikesByImage: Record<string, number> = {};
  showTodayLikesOnly = false;
  showReviewedOnly = false;

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
    if (artwork.category !== '18+ Sketches') {
      return artwork.imageLarge ?? artwork.imageSmall ?? '';
    }

    if (!this.adultImageAccessToken) {
      return artwork.image;
    }

    const separator = artwork.image.includes('?') ? '&' : '?';
    return `${artwork.image}${separator}access_token=${encodeURIComponent(this.adultImageAccessToken)}`;
  }

  getArtworkSrcset(artwork: Artwork): string {
    if (
      artwork.category === '18+ Sketches'
      || !artwork.imageSmall
      || !artwork.imageLarge
      || !artwork.imageSmallWidth
      || !artwork.imageLargeWidth
    ) {
      return '';
    }

    if (artwork.imageSmallWidth === artwork.imageLargeWidth) {
      return `${artwork.imageLarge} ${artwork.imageLargeWidth}w`;
    }

    return `${artwork.imageSmall} ${artwork.imageSmallWidth}w, ${artwork.imageLarge} ${artwork.imageLargeWidth}w`;
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

    if (this.showTodayLikesOnly) {
      filtered = filtered.filter(artwork => this.getTodayLikeCount(artwork) > 0);
    }

    if (this.showReviewedOnly) {
      filtered = filtered.filter(artwork => this.getArtworkReviewCount(artwork) > 0);
    }

    return filtered.sort((a, b) => {
      const numericId = (artwork: Artwork): string | undefined =>
        artwork.title.match(/\d+/)?.[0]
        ?? artwork.image.split(/[\\/]/).pop()?.match(/\d+/)?.[0];
      const aNumericId = numericId(a);
      const bNumericId = numericId(b);

      if (aNumericId && bNumericId) {
        const aId = BigInt(aNumericId);
        const bId = BigInt(bNumericId);

        if (aId !== bId) {
          return aId > bId ? -1 : 1;
        }
      }

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
  this.loadArtworkReviewCounts(imageAccessToken);

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

  loadArtworkReviewCounts(adultAccessToken = ''): void {
    this.reviewCountsLoaded = false;
    this.reviewCountsMessage = '';
    this.artworkReviewCounts = {};

    this.drawingsService.getArtworkReviewCounts(adultAccessToken).subscribe({
      next: counts => {
        this.artworkReviewCounts = counts;
        this.reviewCountsLoaded = true;
        this.cdr.detectChanges();
      },
      error: error => {
        console.error('Failed to load artwork review counts:', error);
        this.reviewCountsMessage = 'Review counts are temporarily unavailable.';
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
          this.todayLikesByImage = activity.likesByImage ?? {};
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

  getTodayLikeCount(artwork: Artwork): number {
    return this.todayLikesByImage[normalizeImagePath(artwork.image, artwork.category)] || 0;
  }

  getArtworkReviewCount(artwork: Artwork): number {
    return this.artworkReviewCounts[normalizeImagePath(artwork.image, artwork.category)] || 0;
  }

  getAffiliateLinkAfterArtwork(index: number): { label: string; url: string } | null {
    if (index !== 5 && index !== 11) return null;

    const artworkNumber = (this.currentPage - 1) * this.pageSize + index + 1;
    if (artworkNumber >= this.filteredArtworks.length) return null;

    const linkIndex = (this.currentPage - 1) * 2 + (index === 5 ? 0 : 1);
    return this.affiliateLinks[linkIndex] ?? null;
  }

  onActivityFilterChange(): void {
    this.currentPage = 1;
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

 openReviews(event: MouseEvent, artwork: Artwork): void {
   event.stopPropagation();
   this.reviewArtwork = artwork;
   this.artworkReviews = [];
   this.reviewName = '';
   this.reviewRating = 5;
   this.reviewComment = '';
   this.reviewWebsite = '';
   this.reviewMessage = '';
   this.loadArtworkReviews();
 }

 closeReviews(): void {
   this.reviewArtwork = null;
 }

 private loadArtworkReviews(): void {
   const artwork = this.reviewArtwork;
   if (!artwork) return;

   this.reviewsLoading = true;
   this.drawingsService
     .getArtworkReviews(
       artwork.image,
       artwork.category,
       artwork.category === '18+ Sketches' ? this.adultImageAccessToken : ''
     )
     .subscribe({
       next: reviews => {
         this.artworkReviews = reviews;
         this.reviewsLoading = false;
         this.cdr.detectChanges();
       },
       error: error => {
         console.error('Failed to load artwork reviews:', error);
         this.reviewsLoading = false;
         this.reviewMessage = 'Reviews could not be loaded. Please try again.';
         this.cdr.detectChanges();
       }
     });
 }

 submitArtworkReview(): void {
   const artwork = this.reviewArtwork;
   const comment = this.reviewComment.trim();
   if (!artwork || this.reviewSubmitting || comment.length < 5) return;

   this.reviewSubmitting = true;
   this.reviewMessage = '';
   this.drawingsService
     .submitArtworkReview(
       artwork.image,
       artwork.category,
       {
         name: this.reviewName.trim(),
         rating: this.reviewRating,
         comment,
         website: this.reviewWebsite
       },
       artwork.category === '18+ Sketches' ? this.adultImageAccessToken : ''
     )
     .subscribe({
       next: () => {
         this.reviewSubmitting = false;
         this.reviewComment = '';
         this.reviewMessage = 'Thanks! Your review was sent for approval.';
         this.cdr.detectChanges();
       },
       error: error => {
         console.error('Failed to submit artwork review:', error);
         this.reviewSubmitting = false;
         this.reviewMessage = error?.status === 429
           ? 'Too many submissions. Please try again later.'
           : error?.error?.error || 'Your review could not be submitted. Please try again.';
         this.cdr.detectChanges();
       }
     });
 }

 reviewStars(rating: number): string {
   return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
 }


}
