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
  Artwork
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
  adultOtpSent = false;
  isAdultConfirmed = false;
  adultImageAccessToken = '';
  isPayment = false;
  private adultAccessConfirmedThisSession = false;
  paymentInfoOpen = false;


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
      if (this.activeCategory === '18+ Sketches' && a.isFreePreview !== b.isFreePreview) {
        return a.isFreePreview ? -1 : 1;
      }

      const recency = (artwork: Artwork): number => Math.max(
        Date.parse(`${artwork.date || ''}T00:00:00.000Z`) || 0,
        Date.parse(artwork.modifiedAt || '') || 0
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
      .likeDrawing(artwork.image)
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
    if (!this.isAdultConfirmed || this.adultAccessBusy || this.adultOtpSent) return;
    this.adultAccessBusy = true;
    this.adultAccessError = '';
    const pendingDetails = {
      name: this.adultName.trim(),
      email: this.adultEmail.trim().toLowerCase(),
      isAdult: this.isAdultConfirmed
    };
    try {
      localStorage.setItem('pendingAdultEmailVerification', JSON.stringify(pendingDetails));
    } catch {
      this.adultAccessBusy = false;
      this.adultAccessError = 'Email verification needs browser storage enabled. Please enable it and try again.';
      return;
    }
    this.drawingsService.beginAdultEmailVerification({
      name: pendingDetails.name,
      email: pendingDetails.email,
      isAdult: this.isAdultConfirmed
    }).subscribe({
      next: () => {
        this.adultOtpSent = true;
        this.adultAccessBusy = false;
        this.cdr.detectChanges();
      },
      error: error => {
        localStorage.removeItem('pendingAdultEmailVerification');
        this.adultAccessBusy = false;
        this.adultAccessError = error?.error?.error || 'Verification code could not be sent. Please try again.';
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
      this.adultAccessError = 'Email verification could not be completed. Please request a new email.';
      this.cdr.detectChanges();
      return;
    }
    localStorage.removeItem('pendingAdultEmailVerification');
    this.isPayment = response.isPayment;
    this.rememberAdultAccessForCurrentSession(response.imageAccessToken);
    this.adultAccessOpen = false;
    this.adultAccessBusy = false;
    this.adultOtpSent = false;
    this.activeCategory = '18+ Sketches';
    this.currentPage = 1;
    this.loadDrawings(this.adultImageAccessToken);
    this.cdr.detectChanges();
  }

  isLockedArtwork(artwork: Artwork): boolean {
    return artwork.category === '18+ Sketches' && !artwork.isFreePreview && !this.isPayment;
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


    // Scroll back to gallery.

    window.scrollTo({

      top:
        document
          .getElementById('work')
          ?.offsetTop ?? 0,

      behavior: 'smooth'

    });

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
