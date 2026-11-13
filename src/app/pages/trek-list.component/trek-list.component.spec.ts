import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';

import { DrawingArtComponent } from './trek-list.component';

describe('DrawingArtComponent', () => {
  let component: DrawingArtComponent;
  let fixture: ComponentFixture<DrawingArtComponent>;
  const requestedTokens: string[] = [];
  let registeredDetails: { name: string; email: string; isAdult: boolean } | undefined;
  const drawingsService = {
    getDrawings: (token = '') => {
      requestedTokens.push(token);
      return of([]);
    },
    registerAdultViewer: (details: { name: string; email: string; isAdult: boolean }) => {
      registeredDetails = details;
      return of({ ok: true, imageAccessToken: 'new-access-token', isPayment: false });
    },
    getLikes: () => of({}),
    getTodayActivity: () => of({ date: '', likes: 0, visits: 0 }),
    recordVisit: () => of({ visits: 0 })
  };

  beforeEach(async () => {
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

  it('keeps TopFive previews free while locking other adult artwork until paid', () => {
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
    expect(component.isLockedArtwork(paidArtwork)).toBe(true);

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
});
