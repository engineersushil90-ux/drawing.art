import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Artwork, DrawingsService, normalizeImagePath } from '../../core/services/drawings.service';

import { DrawingArtComponent } from './trek-list.component';

describe('DrawingArtComponent', () => {
  let component: DrawingArtComponent;
  let fixture: ComponentFixture<DrawingArtComponent>;
  const requestedTokens: string[] = [];
  let drawingsResponse: Artwork[] = [];
  let reviewCountsResponse: Record<string, number> = {};
  let registeredDetails: { name: string; email: string; isAdult: boolean } | undefined;
  const paymentRequests: string[] = [];
  const likedImages: string[] = [];
  const submittedReviews: Array<{
    image: string;
    category: string;
    name: string;
    rating: number;
    comment: string;
    website: string;
    accessToken: string;
  }> = [];
  const drawingsService = {
    getDrawings: (token = '') => {
      requestedTokens.push(token);
      return of(drawingsResponse);
    },
    registerAdultViewer: (details: { name: string; email: string; isAdult: boolean }) => {
      registeredDetails = details;
      return of({ ok: true, imageAccessToken: 'new-access-token', isPayment: false });
    },
    requestAdultPaymentApproval: (token: string) => {
      paymentRequests.push(token);
      return of({ ok: true, paymentRequestedAt: new Date().toISOString() });
    },
    likeDrawing: (image: string, category: string) => {
      const normalizedImage = normalizeImagePath(image, category);
      likedImages.push(normalizedImage);
      return of({ image: normalizedImage, likes: 1 });
    },
    getArtworkReviews: () => of([]),
    getArtworkReviewCounts: () => of(reviewCountsResponse),
    submitArtworkReview: (
      image: string,
      category: string,
      review: { name: string; rating: number; comment: string; website: string },
      accessToken: string
    ) => {
      submittedReviews.push({
        image: normalizeImagePath(image, category),
        category,
        ...review,
        accessToken
      });
      return of({ ok: true });
    },
    getLikes: () => of({}),
    getTodayActivity: () => of({ date: '', likes: 0, visits: 0 }),
    recordVisit: () => of({ visits: 0 })
  };

  beforeEach(async () => {
    drawingsResponse = [];
    reviewCountsResponse = {};
    await TestBed.configureTestingModule({
      imports: [DrawingArtComponent],
      providers: [
        provideRouter([]),
        { provide: DrawingsService, useValue: drawingsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DrawingArtComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses responsive WebP candidates and prioritizes the hero image', () => {
    const artwork = {
      title: 'Featured artwork',
      category: 'Feature Drawing',
      year: '2026',
      image: '/drawings/FeatureDrawing/featured.jpeg',
      imageSmall: '/drawings-optimized/FeatureDrawing/featured-480.webp',
      imageLarge: '/drawings-optimized/FeatureDrawing/featured-960.webp',
      imageSmallWidth: 480,
      imageLargeWidth: 960,
      alt: 'Featured artwork'
    };
    drawingsResponse = [artwork];
    component.loadDrawings();
    fixture.detectChanges();

    const heroImage = fixture.nativeElement.querySelector('.hero-art img') as HTMLImageElement;
    const heroSource = fixture.nativeElement.querySelector('.hero-art source') as HTMLSourceElement;
    expect(heroImage.getAttribute('fetchpriority')).toBe('high');
    expect(heroImage.getAttribute('loading')).toBe('eager');
    expect(heroSource.srcset).toContain('featured-480.webp 480w');
    expect(heroSource.srcset).toContain('featured-960.webp 960w');
  });

  it('shows and updates like counts for drawings with root-relative image URLs', () => {
    const artwork = {
      title: 'Likeable drawing',
      category: 'Pencil Sketches',
      year: '2026',
      image: '/drawings/PencilSketches/drawing.jpg',
      alt: 'Likeable drawing'
    };
    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
    likedImages.length = 0;
    component.likes['drawings/PencilSketches/drawing.jpg'] = 4;

    expect(component.getLikeCount(artwork)).toBe(4);
    component.likeDrawing(event, artwork);

    expect(likedImages).toEqual(['drawings/PencilSketches/drawing.jpg']);
    expect(component.getLikeCount(artwork)).toBe(1);
  });

  it('shows the approved review count on each gallery image', () => {
    const artwork = {
      title: 'Reviewed drawing',
      category: 'Pencil Sketches',
      year: '2026',
      image: '/drawings/PencilSketches/reviewed.jpg',
      alt: 'Reviewed drawing'
    };
    drawingsResponse = [artwork];
    reviewCountsResponse = { 'drawings/PencilSketches/reviewed.jpg': 3 };

    component.loadDrawings();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.review-count-badge') as HTMLElement;
    expect(badge.textContent.trim()).toBe('3 reviews');
    expect(badge.getAttribute('aria-label')).toBe('3 reviews and comments');
    expect(badge.style.top).toBe('14px');
    expect(badge.style.bottom).toBe('auto');
  });

  it('allows liking 18+ sketches and updates their count', () => {
    const artwork = {
      title: 'Likeable adult drawing',
      category: '18+ Sketches',
      year: '2026',
      image: 'https://drawing-art.onrender.com/api/18plus/image?file=2026-09-14%2FSK28126674.jpeg',
      alt: 'Likeable adult drawing'
    };
    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
    likedImages.length = 0;
    component.likes['drawings/18+Sketches/2026-09-14/SK28126674.jpeg'] = 7;

    expect(component.getLikeCount(artwork)).toBe(7);

    component.likeDrawing(event, artwork);

    expect(likedImages).toEqual(['drawings/18+Sketches/2026-09-14/SK28126674.jpeg']);
    expect(component.getLikeCount(artwork)).toBe(1);
  });

  it('submits artwork feedback for moderation', () => {
    const artwork = {
      title: 'Reviewable drawing',
      category: 'Pencil Sketches',
      year: '2026',
      image: '/drawings/PencilSketches/drawing.jpg',
      alt: 'Reviewable drawing'
    };
    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
    submittedReviews.length = 0;

    component.openReviews(event, artwork);
    component.reviewName = 'Art viewer';
    component.reviewRating = 4;
    component.reviewComment = 'Beautiful pencil details.';
    component.submitArtworkReview();

    expect(submittedReviews).toEqual([{
      image: 'drawings/PencilSketches/drawing.jpg',
      category: 'Pencil Sketches',
      name: 'Art viewer',
      rating: 4,
      comment: 'Beautiful pencil details.',
      website: '',
      accessToken: ''
    }]);
    expect(component.reviewMessage).toContain('sent for approval');
  });

  it('changes pages without scrolling away from the pagination controls', () => {
    component.activeCategory = 'Pencil Sketches';
    component.artworks = Array.from({ length: component.pageSize + 1 }, (_, index) => ({
      title: `Drawing ${index}`,
      category: 'Pencil Sketches',
      year: '2026',
      image: `drawing-${index}.jpg`,
      alt: `Drawing ${index}`
    }));
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    component.nextPage();

    expect(component.currentPage).toBe(2);
    expect(scrollToSpy).not.toHaveBeenCalled();
    scrollToSpy.mockRestore();
  });

  it('sorts timestamp-renamed drawings newest first', () => {
    component.activeCategory = 'Pencil Sketches';
    component.artworks = [
      {
        title: 'Older',
        category: 'Pencil Sketches',
        year: '2026',
        date: '2026-09-14',
        image: 'older.jpg',
        alt: 'Older',
        addedAt: '2026-11-14T07:00:00.000Z'
      },
      {
        title: 'Newest',
        category: 'Pencil Sketches',
        year: '2026',
        date: '2026-09-14',
        image: 'newest.jpg',
        alt: 'Newest',
        addedAt: '2026-11-14T07:30:00.000Z'
      }
    ];

    expect(component.filteredArtworks.map(artwork => artwork.title)).toEqual(['Newest', 'Older']);
  });

  it('allows adult artwork without payment while payment is disabled', () => {
    const preview = {
      title: 'Preview',
      category: '18+ Sketches',
      year: '2026',
      image: '',
      alt: '',
      isFreePreview: true
    };
    const paidArtwork = { ...preview, title: 'Locked', isFreePreview: false };

    expect(component.isLockedArtwork(preview)).toBe(false);
    expect(component.adultPaymentRequired).toBe(false);
    expect(component.isLockedArtwork(paidArtwork)).toBe(false);

    component.openArtwork(paidArtwork);
    expect(component.selectedArtwork).toBe(paidArtwork);
    expect(component.paymentInfoOpen).toBe(false);

    component.isPayment = true;
    expect(component.isLockedArtwork(paidArtwork)).toBe(false);
  });

  it('reuses adult access in another tab without reopening the age gate', () => {
    requestedTokens.length = 0;
    localStorage.setItem('adultSketchImageAccessToken', 'verified-access-token');

    component.selectCategory('18+ Sketches');

    expect(component.adultAccessOpen).toBe(false);
    expect(component.activeCategory).toBe('18+ Sketches');
    expect(requestedTokens).toContain('verified-access-token');

    localStorage.removeItem('adultSketchImageAccessToken');
  });

  it('saves viewer details and opens the blurred gallery without email verification', () => {
    registeredDetails = undefined;
    component.adultName = '  Viewer Name ';
    component.adultEmail = '  viewer@example.com ';
    component.isAdultConfirmed = true;

    component.confirmAdultAccess();

    expect(registeredDetails).toEqual({
      name: 'Viewer Name',
      email: 'viewer@example.com',
      isAdult: true
    });
    expect(component.adultAccessOpen).toBe(false);
    expect(component.activeCategory).toBe('18+ Sketches');
    expect(component.isPayment).toBe(false);
    expect(localStorage.getItem('adultSketchImageAccessToken')).toBe('new-access-token');
    localStorage.removeItem('adultSketchImageAccessToken');
  });

  it('submits a payment approval request only when the viewer confirms payment', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    paymentRequests.length = 0;
    component.adultImageAccessToken = 'viewer-access-token';
    component.paymentInfoOpen = true;

    component.closePaymentInfo();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(paymentRequests).toEqual(['viewer-access-token']);
    expect(component.paymentInfoOpen).toBe(false);
    expect(component.paymentRequestMessage).toContain('admin approval');
    confirmSpy.mockRestore();
  });

  it('does not submit a payment request when the viewer says payment is not complete', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    paymentRequests.length = 0;
    component.adultImageAccessToken = 'viewer-access-token';
    component.paymentInfoOpen = true;

    component.closePaymentInfo();

    expect(paymentRequests).toEqual([]);
    expect(component.paymentInfoOpen).toBe(false);
    confirmSpy.mockRestore();
  });
});
