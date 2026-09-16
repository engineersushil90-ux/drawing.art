import {
  Component,
  OnInit,
  inject,
  afterNextRender
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  DrawingsService,
  Artwork
} from '../../core/services/drawings.service';


@Component({
  selector: 'app-drawing-art',
  imports: [CommonModule],
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


  // --------------------------------------------------
  // DRAWINGS
  // --------------------------------------------------

  artworks: Artwork[] = [];


  // --------------------------------------------------
  // LIKES
  // --------------------------------------------------

  likes: Record<string, number> = {};


  // --------------------------------------------------
  // VISITS
  // --------------------------------------------------

  visits = 0;


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
  });


  // --------------------------------------------------
  // FEATURE DRAWING
  // --------------------------------------------------
  //
  // Finds the drawing coming from the FeatureDrawing folder.
  //

  get featuredArtwork(): Artwork | null {

    return this.artworks.find(
      artwork =>
        artwork.category === 'Feature Drawing'
    ) ?? null;

  }


  // --------------------------------------------------
  // FILTERED DRAWINGS
  // --------------------------------------------------
  //
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

    if (this.activeCategory === 'All Drawings') {

      return this.artworks.filter(
        artwork =>
          artwork.category !== '18+ Sketches' &&
          artwork.category !== 'Feature Drawing'
      );

    }


    return this.artworks.filter(
      artwork =>
        artwork.category === this.activeCategory
    );

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

    this.loadDrawings();

    this.loadLikes();

  }


  // --------------------------------------------------
  // LOAD DRAWINGS
  // --------------------------------------------------

  loadDrawings(): void {

    this.isLoading = true;


    this.drawingsService
      .getDrawings()
      .subscribe({

        next: drawings => {

          console.log(
            'API drawings:',
            drawings
          );


          this.artworks = drawings;

          this.isLoading = false;

        },


        error: error => {

          console.error(
            'Failed to load drawings:',
            error
          );


          this.isLoading = false;

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

        },


        error: error => {

          console.error(
            'Failed to load likes:',
            error
          );

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


          console.log(
            'Total site visits:',
            this.visits
          );

        },


        error: error => {

          console.error(
            'Failed to record visit:',
            error
          );

        }

      });

  }


  // --------------------------------------------------
  // CATEGORY
  // --------------------------------------------------

  selectCategory(
    category: string
  ): void {

    this.activeCategory =
      category;


    // Always start from page 1
    // when changing category.

    this.currentPage = 1;

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