import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DrawingsService } from './drawings.service';

describe('DrawingsService', () => {
  let service: DrawingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(DrawingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resolves server-generated previews against the image API host', () => {
    service.getDrawings().subscribe(drawings => {
      expect(drawings[0].imageSmall).toBe(
        'https://drawing-art.onrender.com/api/drawings/preview?file=drawings%2FColorArt%2Fnew.jpeg&width=480'
      );
      expect(drawings[0].imageLarge).toBe(
        'https://drawing-art.onrender.com/api/drawings/preview?file=drawings%2FColorArt%2Fnew.jpeg&width=960'
      );
    });

    const request = http.expectOne('https://drawing-art.onrender.com/api/drawings');
    request.flush([{
      title: 'New artwork',
      category: 'Color Art',
      year: '2026',
      image: '/drawings/ColorArt/new.jpeg',
      imageSmall: '/api/drawings/preview?file=drawings%2FColorArt%2Fnew.jpeg&width=480',
      imageLarge: '/api/drawings/preview?file=drawings%2FColorArt%2Fnew.jpeg&width=960',
      imageSmallWidth: 480,
      imageLargeWidth: 960,
      alt: 'New artwork'
    }]);
  });

  it('sends the selected image and collection to the admin upload endpoint', () => {
    const image = new File(['image'], 'sketch.png', { type: 'image/png' });
    service.uploadSketch(image, 'Color Art').subscribe(response => {
      expect(response.ok).toBe(true);
    });

    const request = http.expectOne('https://drawing-art.onrender.com/api/admin/drawings');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    const formData = request.request.body as FormData;
    expect(formData.get('category')).toBe('Color Art');
    expect(formData.get('image')).toMatchObject({
      name: 'sketch.png',
      type: 'image/png',
      size: 5
    });
    request.flush({ ok: true, image: 'drawings/ColorArt/new.png', category: 'Color Art' });
  });
});
