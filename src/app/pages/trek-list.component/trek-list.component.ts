import {
  Component,
  OnInit,
  inject
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

  readonly currentYear = new Date().getFullYear();
  private readonly drawingsService =
    inject(DrawingsService);

  readonly categories = [
    'All Drawings',
    'Pencil Sketches',
    '18+ Sketches',
    'Color Art'
  ];

  activeCategory = 'All Drawings';

  selectedArtwork: Artwork | null = null;

  isMenuOpen = false;

  artworks: Artwork[] = [];

  isLoading = true;

  get visibleArtworks(): Artwork[] {

    if (this.activeCategory === 'All Drawings') {
      return this.artworks.filter(
      artwork => artwork.category !== '18+ Sketches'
    );
    }

    return this.artworks.filter(
      artwork =>
        artwork.category === this.activeCategory
    );
  }

  get featuredArtwork(): Artwork | null {
  return this.artworks.find(
    artwork => artwork.category === 'Feature Drawing'
  ) ?? null;
}

  ngOnInit(): void {

    this.loadDrawings();

  }

  loadDrawings(): void {

    this.isLoading = true;

    this.drawingsService
      .getDrawings()
      .subscribe({

        next: (drawings) => {

          this.artworks = drawings;

          this.isLoading = false;

          console.log(
            'Drawings loaded:',
            drawings
          );
        },

        error: (error) => {

          console.error(
            'Failed to load drawings:',
            error
          );

          this.isLoading = false;
        }

      });
  }

  selectCategory(category: string): void {

    this.activeCategory = category;

  }

  openArtwork(artwork: Artwork): void {

    this.selectedArtwork = artwork;

  }

  closeArtwork(): void {

    this.selectedArtwork = null;

  }

}