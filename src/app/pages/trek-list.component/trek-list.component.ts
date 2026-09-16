import { Component, OnInit, inject } from '@angular/core';
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

  likes: Record<string, number> = {};

  private readonly drawingsService =
    inject(DrawingsService);


  get featuredArtwork(): Artwork | null {
    return this.artworks.find(
      artwork => artwork.category === 'Feature Drawing'
    ) ?? null;
  }


  get visibleArtworks(): Artwork[] {

    if (this.activeCategory === 'All Drawings') {

      return this.artworks.filter(
        artwork =>
          artwork.category !== '18+ Sketches' &&
          artwork.category !== 'Feature Drawing'
      );

    }

    return this.artworks.filter(
      artwork => artwork.category === this.activeCategory
    );
  }


  ngOnInit(): void {

    this.loadDrawings();

    this.loadLikes();

  }


  loadDrawings(): void {

    this.isLoading = true;

    this.drawingsService.getDrawings().subscribe({

      next: drawings => {

        this.artworks = drawings;

        this.isLoading = false;

        console.log('Drawings loaded:', drawings);

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


  loadLikes(): void {

    this.drawingsService.getLikes().subscribe({

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


  likeDrawing(
    event: MouseEvent,
    artwork: Artwork
  ): void {

    event.stopPropagation();

    this.drawingsService
      .likeDrawing(artwork.image)
      .subscribe({

        next: response => {

          this.likes[response.image] =
            response.likes;

        },

        error: error => {

          console.error(
            'Failed to like drawing:',
            error
          );

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