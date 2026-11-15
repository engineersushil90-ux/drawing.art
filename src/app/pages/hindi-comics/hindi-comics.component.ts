import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { getFirstNewComicTarget, HINDI_COMICS, ComicPart, ComicSeries } from './hindi-comics.data';

@Component({
  selector: 'app-hindi-comics',
  imports: [CommonModule, RouterModule],
  templateUrl: './hindi-comics.component.html',
  styleUrl: './hindi-comics.component.scss'
})
export class HindiComicsComponent {
  private readonly route = inject(ActivatedRoute);
  readonly comics = HINDI_COMICS;
  readonly newComicTarget = getFirstNewComicTarget();

  selectedComicId = this.comics[0].id;
  selectedPartId = this.comics[0].parts[0].id;

  constructor() {
    const comicId = this.route.snapshot.queryParamMap.get('comic');
    const partId = this.route.snapshot.queryParamMap.get('part');
    const comic = this.comics.find(item => item.id === comicId);
    if (comic) {
      this.selectComic(comic);
      if (partId && comic.parts.some(part => part.id === partId)) {
        this.selectedPartId = partId;
      }
    }
  }

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

  selectNewComic(): void {
    if (!this.newComicTarget) return;
    const comic = this.comics.find(item => item.id === this.newComicTarget?.comic);
    if (!comic) return;
    this.selectComic(comic);
    const part = comic.parts.find(item => item.id === this.newComicTarget?.part);
    if (part) this.selectPart(part);
  }
}
