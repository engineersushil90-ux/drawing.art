import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';
import { AdminViewersComponent } from './admin-viewers.component';

describe('AdminViewersComponent', () => {
  let fixture: ComponentFixture<AdminViewersComponent>;
  const drawingsService = {
    adminLogin: vi.fn(() => of({ ok: true, accessToken: 'admin-token' })),
    getAdminSession: vi.fn(() => new Observable<{ ok: boolean }>(subscriber => {
      subscriber.error({ status: 401 });
    })),
    uploadSketch: vi.fn((_file: File, category: string) => of({
      ok: true,
      image: 'drawings/ColorArt/2026-11-15/SK_test.jpeg',
      category
    })),
    uploadComicPage: vi.fn((_file: File, comicId: string, partId: string) => of({
      ok: true,
      page: `/api/hindi-comics/page?file=${comicId}%2F${partId}%2Fpage.webp`,
      pageNumber: 1
    })),
    getAdultViewers: vi.fn(() => of([{
      name: 'Test Viewer',
      email: 'viewer@example.com',
      firstViewedAt: '2026-11-14T00:00:00.000Z',
      lastViewedAt: '2026-11-14T01:00:00.000Z',
      views: 2,
      isPayment: false
    }])),
    getPendingArtworkReviews: vi.fn(() => of([{
      id: 'review-1',
      imagePath: 'drawings/PencilSketches/drawing.jpg',
      name: 'Art viewer',
      rating: 4,
      comment: 'Beautiful pencil details.',
      createdAt: '2026-11-14T01:00:00.000Z',
      status: 'pending' as const
    }])),
    getAdminReviewImageUrl: vi.fn((imagePath: string) =>
      `https://drawing-art.onrender.com/api/admin/review-image?image=${encodeURIComponent(imagePath)}`
    ),
    moderateArtworkReview: vi.fn(() => of({ ok: true })),
    getCustomDrawingRequests: vi.fn(() => of([{
      id: 'request-1',
      name: 'Drawing customer',
      email: 'customer@example.com',
      description: 'Please draw a landscape with mountains.',
      createdAt: '2026-11-14T02:00:00.000Z',
      hasReferenceImage: true
    }])),
    getAdminCustomDrawingRequestImageUrl: vi.fn((id: string) =>
      `https://drawing-art.onrender.com/api/admin/custom-drawing-requests/${encodeURIComponent(id)}/reference`
    )
  };

  beforeEach(async () => {
    drawingsService.adminLogin.mockClear();
    drawingsService.getAdminSession.mockClear();
    drawingsService.uploadSketch.mockClear();
    drawingsService.uploadComicPage.mockClear();
    drawingsService.getAdultViewers.mockClear();
    drawingsService.getPendingArtworkReviews.mockClear();
    drawingsService.moderateArtworkReview.mockClear();
    drawingsService.getCustomDrawingRequests.mockClear();
    drawingsService.getAdminCustomDrawingRequestImageUrl.mockClear();
    await TestBed.configureTestingModule({
      imports: [AdminViewersComponent],
      providers: [
        provideRouter([]),
        { provide: DrawingsService, useValue: drawingsService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminViewersComponent);
    fixture.detectChanges();
  });

  it('keeps names hidden until login, then shows viewer names and emails', () => {
    expect(drawingsService.adminLogin).not.toHaveBeenCalled();
    expect(drawingsService.getAdminSession).toHaveBeenCalledOnce();
    expect(drawingsService.getAdultViewers).not.toHaveBeenCalled();
    expect(drawingsService.getPendingArtworkReviews).not.toHaveBeenCalled();
    expect(drawingsService.getCustomDrawingRequests).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('viewer@example.com');

    fixture.componentInstance.username = 'owner';
    fixture.componentInstance.password = 'password';
    fixture.componentInstance.login();
    fixture.detectChanges();

    expect(drawingsService.adminLogin).toHaveBeenCalledOnce();
    expect(drawingsService.getAdultViewers).toHaveBeenCalledOnce();
    expect(drawingsService.getPendingArtworkReviews).toHaveBeenCalledOnce();
    expect(drawingsService.getCustomDrawingRequests).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.message).toBe('Signed in successfully.');
    expect(fixture.nativeElement.textContent).toContain('Test Viewer');
    expect(fixture.nativeElement.textContent).toContain('viewer@example.com');
    expect(fixture.nativeElement.textContent).toContain('Beautiful pencil details.');
    expect(fixture.nativeElement.textContent).toContain('Please draw a landscape with mountains.');
    const reviewImage = fixture.nativeElement.querySelector('.moderation-artwork-preview') as HTMLImageElement;
    expect(reviewImage.src).toContain('/api/admin/review-image?image=drawings%2FPencilSketches%2Fdrawing.jpg');
    expect(reviewImage.crossOrigin).toBe('use-credentials');
    const requestImage = fixture.nativeElement.querySelector('.request-reference-preview') as HTMLImageElement;
    expect(requestImage.src).toContain('/api/admin/custom-drawing-requests/request-1/reference');
    expect(requestImage.crossOrigin).toBe('use-credentials');
  });

  it('restores the admin dashboard when the signed session cookie is valid', () => {
    drawingsService.getAdminSession.mockReturnValueOnce(of({ ok: true }));
    const restoredFixture = TestBed.createComponent(AdminViewersComponent);
    restoredFixture.detectChanges();

    expect(restoredFixture.componentInstance.authenticated).toBe(true);
    expect(drawingsService.getAdultViewers).toHaveBeenCalled();
    expect(drawingsService.getPendingArtworkReviews).toHaveBeenCalled();
    expect(drawingsService.getCustomDrawingRequests).toHaveBeenCalled();
    restoredFixture.destroy();
  });

  it('keeps the sign-in form available while checking a saved session', () => {
    drawingsService.getAdminSession.mockReturnValueOnce(NEVER);
    const pendingFixture = TestBed.createComponent(AdminViewersComponent);
    pendingFixture.detectChanges();

    expect(pendingFixture.componentInstance.checkingAdminSession).toBe(true);
    expect(pendingFixture.nativeElement.querySelector('form')).not.toBeNull();
    pendingFixture.destroy();
  });

  it('removes a review from the queue after approving it', () => {
    const component = fixture.componentInstance;
    component.authenticated = true;
    component.pendingReviews = [{
      id: 'review-1',
      imagePath: 'drawings/PencilSketches/drawing.jpg',
      name: 'Art viewer',
      rating: 4,
      comment: 'Beautiful pencil details.',
      createdAt: '2026-11-14T01:00:00.000Z',
      status: 'pending'
    }];

    component.moderateReview(component.pendingReviews[0], 'approved');
    fixture.detectChanges();

    expect(drawingsService.moderateArtworkReview).toHaveBeenCalledWith('review-1', 'approved');
    expect(component.pendingReviews).toEqual([]);
    expect(component.reviewsMessage).toBe('Review approved and published. Open this artwork’s Reviews & feedback to see it.');
  });

  it('re-enables review moderation and asks for a refresh when the request stalls', () => {
    vi.useFakeTimers();
    drawingsService.moderateArtworkReview.mockReturnValueOnce(NEVER);
    const component = fixture.componentInstance;
    component.pendingReviews = [{
      id: 'review-1',
      imagePath: 'drawings/PencilSketches/drawing.jpg',
      name: 'Art viewer',
      rating: 4,
      comment: 'Beautiful pencil details.',
      createdAt: '2026-11-14T01:00:00.000Z',
      status: 'pending'
    }];

    component.moderateReview(component.pendingReviews[0], 'approved');
    expect(component.moderatingReviewId).toBe('review-1');
    expect(component.moderatingReviewStatus).toBe('approved');

    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(component.moderatingReviewId).toBeNull();
    expect(component.moderatingReviewStatus).toBeNull();
    expect(component.reviewsMessage).toContain('No response after 30 seconds.');
    vi.useRealTimers();
  });

  it('shows an unavailable state if a custom request reference image fails', () => {
    const component = fixture.componentInstance;
    const request = {
      id: 'request-1',
      name: 'Drawing customer',
      email: 'customer@example.com',
      description: 'Please draw a landscape with mountains.',
      createdAt: '2026-11-14T02:00:00.000Z',
      hasReferenceImage: true
    };
    component.authenticated = true;
    component.customDrawingRequests = [request];
    component.onCustomRequestImageError(request);
    fixture.detectChanges();

    expect(component.customRequestImageErrors['request-1']).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Reference image unavailable.');
  });

  it('shows success after refreshing drawing requests', () => {
    const component = fixture.componentInstance;
    component.loadCustomDrawingRequests(true);

    expect(component.loadingDrawingRequests).toBe(false);
    expect(component.drawingRequestsMessage).toBe('Drawing requests refreshed.');
  });

  it('uploads the selected image to the chosen sketch collection', () => {
    const component = fixture.componentInstance;
    component.authenticated = true;
    component.sketchCategory = 'Color Art';
    const file = new File(['image'], 'drawing.png', { type: 'image/png' });
    component.selectedSketchFile = file;
    fixture.detectChanges();

    component.uploadSketch();
    fixture.detectChanges();

    expect(drawingsService.uploadSketch).toHaveBeenCalledWith(file, 'Color Art');
    expect(component.sketchUploadSucceeded).toBe(true);
    expect(component.sketchUploadMessage).toBe('Sketch uploaded to Color Art.');
  });

  it('uploads a comic page to the selected comic part', () => {
    const component = fixture.componentInstance;
    component.authenticated = true;
    component.comicPageComicId = 'changing-room';
    component.comicPagePartId = 'part-2';
    const file = new File(['page'], 'changing-room-part-2-page-1.png', { type: 'image/png' });
    component.selectedComicPageFile = file;
    fixture.detectChanges();

    component.uploadComicPage();
    fixture.detectChanges();

    expect(drawingsService.uploadComicPage).toHaveBeenCalledWith(file, 'changing-room', 'part-2');
    expect(component.comicPageUploadSucceeded).toBe(true);
    expect(component.comicPageUploadMessage).toContain('Page 1 uploaded to Changing Room, Part 2.');
  });

  it('sorts viewers latest first and paginates at 20 rows', () => {
    const viewers = Array.from({ length: 51 }, (_, index) => ({
      name: `Viewer ${index}`,
      email: `viewer${index}@example.com`,
      firstViewedAt: new Date(1_763_000_000_000 + index * 60_000).toISOString(),
      lastViewedAt: new Date(1_763_000_000_000 + index * 60_000).toISOString(),
      views: 1,
      isPayment: false
    }));
    drawingsService.getAdultViewers.mockReturnValueOnce(of(viewers));
    const component = fixture.componentInstance;

    component.loadViewers();

    expect(component.viewersOnPage).toHaveLength(20);
    expect(component.viewerPageCount).toBe(3);
    expect(component.viewersOnPage[0].name).toBe('Viewer 50');

    component.nextViewerPage();
    expect(component.viewersOnPage).toHaveLength(20);
    expect(component.viewersOnPage[0].name).toBe('Viewer 30');

    component.nextViewerPage();
    expect(component.viewersOnPage).toHaveLength(11);
    expect(component.viewersOnPage[0].name).toBe('Viewer 10');
  });

  it('limits review and drawing request lists to 20 items per page', () => {
    const component = fixture.componentInstance;
    component.pendingReviews = Array.from({ length: 21 }, (_, index) => ({
      id: `review-${index}`,
      imagePath: 'drawings/PencilSketches/drawing.jpg',
      name: `Reviewer ${index}`,
      rating: 5,
      comment: 'Great drawing.',
      createdAt: '2026-11-14T01:00:00.000Z',
      status: 'pending' as const
    }));
    component.customDrawingRequests = Array.from({ length: 21 }, (_, index) => ({
      id: `request-${index}`,
      name: `Customer ${index}`,
      email: `customer${index}@example.com`,
      description: 'Please draw a landscape.',
      createdAt: '2026-11-14T02:00:00.000Z',
      hasReferenceImage: false
    }));

    expect(component.reviewsOnPage).toHaveLength(20);
    expect(component.drawingRequestsOnPage).toHaveLength(20);

    component.nextReviewPage();
    component.nextDrawingRequestPage();
    expect(component.reviewsOnPage).toHaveLength(1);
    expect(component.drawingRequestsOnPage).toHaveLength(1);
  });

  it('shows a clear credential error and re-enables sign-in', () => {
    drawingsService.adminLogin.mockReturnValueOnce(
      throwError(() => ({ status: 401 }))
    );
    fixture.componentInstance.login();
    fixture.detectChanges();

    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.message).toBe('Username or password is incorrect.');
  });

  it('cancels a stalled login and displays a timeout message', () => {
    vi.useFakeTimers();
    drawingsService.adminLogin.mockReturnValueOnce(NEVER);
    fixture.componentInstance.login();

    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.message).toContain('Login request was canceled');
    vi.useRealTimers();
  });
});
