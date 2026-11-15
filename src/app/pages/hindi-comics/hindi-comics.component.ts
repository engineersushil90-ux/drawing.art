import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';
import { getFirstNewComicTarget, HINDI_COMICS, ComicPart, ComicSeries } from './hindi-comics.data';

@Component({
  selector: 'app-hindi-comics',
  imports: [CommonModule, RouterModule],
  templateUrl: './hindi-comics.component.html',
  styleUrl: './hindi-comics.component.scss'
})
export class HindiComicsComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly drawingsService = inject(DrawingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private comicPagesSubscription?: Subscription;
  readonly comics = HINDI_COMICS;
  readonly newComicTarget = getFirstNewComicTarget();

  selectedComicId = this.comics[0].id;
  selectedPartId = this.comics[0].parts[0].id;
  comicPages: string[] = [];
  comicPagesLoading = false;
  comicPagesError = '';

  constructor() {
    const comicId = this.route.snapshot.queryParamMap.get('comic');
    const partId = this.route.snapshot.queryParamMap.get('part');
    const comic = this.comics.find(item => item.id === comicId);
    if (comic) {
      this.selectedComicId = comic.id;
      this.selectedPartId = comic.parts.find(part => part.id === partId)?.id
        ?? comic.parts[0]?.id
        ?? '';
    }
    this.loadComicPages();
  }

  ngOnDestroy(): void {
    this.comicPagesSubscription?.unsubscribe();
  }

  get selectedComic(): ComicSeries | null {
    return this.comics.find(comic => comic.id === this.selectedComicId) ?? null;
  }

  get selectedPart(): ComicPart | null {
    return this.selectedComic?.parts.find(part => part.id === this.selectedPartId) ?? null;
  }

  get hasPreviousPart(): boolean {
    return this.selectedPartIndex > 0;
  }

  get hasNextPart(): boolean {
    const comic = this.selectedComic;
    return !!comic && this.selectedPartIndex >= 0 && this.selectedPartIndex < comic.parts.length - 1;
  }

  selectComic(comic: ComicSeries): void {
    this.selectedComicId = comic.id;
    this.selectedPartId = comic.parts[0]?.id ?? '';
    this.loadComicPages();
  }

  selectPart(part: ComicPart): void {
    this.selectedPartId = part.id;
    this.loadComicPages();
  }

  previousPart(): void {
    this.navigatePart(-1);
  }

  nextPart(): void {
    this.navigatePart(1);
  }

  selectNewComic(): void {
    if (!this.newComicTarget) return;
    const comic = this.comics.find(item => item.id === this.newComicTarget?.comic);
    if (!comic) return;
    this.selectComic(comic);
    const part = comic.parts.find(item => item.id === this.newComicTarget?.part);
    if (part) this.selectPart(part);
  }

  private get selectedPartIndex(): number {
    return this.selectedComic?.parts.findIndex(part => part.id === this.selectedPartId) ?? -1;
  }

  private navigatePart(direction: -1 | 1): void {
    const comic = this.selectedComic;
    const part = comic?.parts[this.selectedPartIndex + direction];
    if (part) this.selectPart(part);
  }

  private loadComicPages(): void {
    const comic = this.selectedComic;
    const part = this.selectedPart;
    if (!comic || !part) {
      this.comicPages = [];
      this.comicPagesError = '';
      return;
    }

    this.comicPagesSubscription?.unsubscribe();
    this.comicPages = [];
    this.comicPagesLoading = true;
    this.comicPagesError = '';
    this.comicPagesSubscription = this.drawingsService.getComicPages(comic.id, part.id).subscribe({
      next: pages => {
        this.comicPages = pages;
        this.comicPagesLoading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.comicPagesLoading = false;
        this.comicPagesError = error?.name === 'TimeoutError'
          ? 'Comic pages took too long to load. Please try again.'
          : error?.error?.error || 'Comic pages could not be loaded. Please try again later.';
        this.cdr.markForCheck();
      }
    });
  }

  retryComicPages(): void {
    this.loadComicPages();
  }
}
