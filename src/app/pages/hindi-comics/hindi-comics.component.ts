import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ComicPart {
  id: string;
  title: string;
}

interface ComicSeries {
  id: string;
  title: string;
  parts: ComicPart[];
}

@Component({
  selector: 'app-hindi-comics',
  imports: [CommonModule, RouterModule],
  templateUrl: './hindi-comics.component.html',
  styleUrl: './hindi-comics.component.scss'
})
export class HindiComicsComponent {
  readonly comics: ComicSeries[] = [
    {
      id: 'changing-room',
      title: 'Changing Room',
      parts: [
        { id: 'part-1', title: 'Part 1' },
        { id: 'part-2', title: 'Part 2' }
      ]
    }
  ];

  selectedComicId = this.comics[0].id;
  selectedPartId = this.comics[0].parts[0].id;

  get selectedComic(): ComicSeries | null {
    return this.comics.find(comic => comic.id === this.selectedComicId) ?? null;
  }

  get selectedPart(): ComicPart | null {
    return this.selectedComic?.parts.find(part => part.id === this.selectedPartId) ?? null;
  }

  selectComic(comic: ComicSeries): void {
    this.selectedComicId = comic.id;
    this.selectedPartId = comic.parts[0]?.id ?? '';
  }

  selectPart(part: ComicPart): void {
    this.selectedPartId = part.id;
  }
}
