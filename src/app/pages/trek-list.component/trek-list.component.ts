import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { featuredDrawing, localDrawings } from '../../core/data/drawings.generated';

type Artwork = { title: string; category: string; year: string; image: string; alt: string };

@Component({ selector: 'app-drawing-art', imports: [CommonModule], templateUrl: './trek-list.component.html', styleUrl: './trek-list.component.scss' })
export class DrawingArtComponent {
  readonly categories = ['All Drawings', 'Pencil Sketches', 'Color Art'];
  activeCategory = 'All Drawings';
  selectedArtwork: Artwork | null = null;
  isMenuOpen = false;
  readonly sampleArtworks: Artwork[] = [
    { title: 'Sunday window', category: 'Color Art', year: '2024', image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=85', alt: 'Abstract warm colored painting' },
    { title: 'Garden notes', category: 'Color Art', year: '2024', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85', alt: 'Paintbrushes and watercolor work' },
    { title: 'Soft landing', category: 'Color Art', year: '2023', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=85', alt: 'Colorful expressive artwork' },
    { title: 'Blue hour', category: 'Color Art', year: '2024', image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=85', alt: 'Blue abstract painting' },
    { title: 'Portrait study', category: 'Pencil Sketches', year: '2023', image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85', alt: 'Detailed drawing in a notebook' },
    { title: 'Night bloom', category: 'Color Art', year: '2024', image: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=85', alt: 'Bright botanical painting' }
  ];
  readonly featuredArtwork = featuredDrawing ?? { title: 'Featured drawing', image: 'https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?auto=format&fit=crop&w=1050&q=85', alt: 'Featured abstract drawing' };
  readonly artworks: Artwork[] = localDrawings.length ? [...localDrawings] : this.sampleArtworks;
  get visibleArtworks(): Artwork[] { return this.activeCategory === 'All Drawings' ? this.artworks : this.artworks.filter((artwork) => artwork.category === this.activeCategory); }
  selectCategory(category: string): void { this.activeCategory = category; }
  openArtwork(artwork: Artwork): void { this.selectedArtwork = artwork; }
  closeArtwork(): void { this.selectedArtwork = null; }
}
