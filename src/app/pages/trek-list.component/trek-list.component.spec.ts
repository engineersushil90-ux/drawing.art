import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';

import { DrawingArtComponent } from './trek-list.component';

describe('DrawingArtComponent', () => {
  let component: DrawingArtComponent;
  let fixture: ComponentFixture<DrawingArtComponent>;
  const drawingsService = {
    getDrawings: () => of([]),
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
});
