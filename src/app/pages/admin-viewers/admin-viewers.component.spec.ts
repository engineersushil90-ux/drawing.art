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
    getCustomDrawingRequestReference: vi.fn(() => of(new Blob(['image'])))
  };

  beforeEach(async () => {
    drawingsService.adminLogin.mockClear();
    drawingsService.getAdminSession.mockClear();
    drawingsService.getAdultViewers.mockClear();
    drawingsService.getPendingArtworkReviews.mockClear();
    drawingsService.moderateArtworkReview.mockClear();
    drawingsService.getCustomDrawingRequests.mockClear();
    drawingsService.getCustomDrawingRequestReference.mockClear();
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

  it('ends a stalled reference-image request with an actionable message', () => {
    vi.useFakeTimers();
    drawingsService.getCustomDrawingRequestReference.mockReturnValueOnce(NEVER);
    const component = fixture.componentInstance;
    component.loadDrawingRequestReference({
      id: 'request-1',
      name: 'Drawing customer',
      email: 'customer@example.com',
      description: 'Please draw a landscape with mountains.',
      createdAt: '2026-11-14T02:00:00.000Z',
      hasReferenceImage: true
    });

    expect(component.loadingReferenceRequestId).toBe('request-1');
    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(component.loadingReferenceRequestId).toBeNull();
    expect(component.drawingRequestsMessage).toContain('No response within 30 seconds');
    vi.useRealTimers();
  });

  it('shows success after refreshing drawing requests', () => {
    const component = fixture.componentInstance;
    component.loadCustomDrawingRequests(true);

    expect(component.loadingDrawingRequests).toBe(false);
    expect(component.drawingRequestsMessage).toBe('Drawing requests refreshed.');
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
