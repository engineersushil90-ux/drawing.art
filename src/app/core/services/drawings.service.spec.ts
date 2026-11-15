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

  it('loads uploaded drawings for the admin and resolves their previews against the API host', () => {
    service.getAdminDrawings().subscribe(drawings => {
      expect(drawings[0].imageSmall).toBe(
        'https://drawing-art.onrender.com/api/drawings/preview?file=drawings%2FColorArt%2F2026-11-15%2Fsketch.png&width=480'
      );
    });

    const request = http.expectOne('https://drawing-art.onrender.com/api/admin/drawings');
    expect(request.request.withCredentials).toBe(true);
    request.flush([{
      image: 'drawings/ColorArt/2026-11-15/sketch.png',
      imageSmall: '/api/drawings/preview?file=drawings%2FColorArt%2F2026-11-15%2Fsketch.png&width=480',
      title: 'sketch',
      category: 'Color Art'
    }]);
  });

  it('deletes an uploaded drawing through the admin endpoint', () => {
    service.deleteAdminDrawing('drawings/ColorArt/2026-11-15/sketch.png').subscribe(response => {
      expect(response.ok).toBe(true);
    });

    const request = http.expectOne('https://drawing-art.onrender.com/api/admin/drawings');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ image: 'drawings/ColorArt/2026-11-15/sketch.png' });
    request.flush({ ok: true });
  });

  it('loads comic page URLs from the image API', () => {
    service.getComicPages('changing-room', 'part-1').subscribe(pages => {
      expect(pages).toEqual([
        'https://drawing-art.onrender.com/api/hindi-comics/page?file=changing-room%2Fpart-1%2Fpage.webp'
      ]);
    });

    const request = http.expectOne(
      'https://drawing-art.onrender.com/api/hindi-comics/pages?comic=changing-room&part=part-1'
    );
    request.flush({ pages: ['/api/hindi-comics/page?file=changing-room%2Fpart-1%2Fpage.webp'] });
  });

  it('uploads a comic page to the selected part', () => {
    const image = new File(['page'], 'part-1-page-1.png', { type: 'image/png' });
    service.uploadComicPage(image, 'changing-room', 'part-1').subscribe(response => {
      expect(response.pageNumber).toBe(1);
    });

    const request = http.expectOne('https://drawing-art.onrender.com/api/admin/hindi-comics/pages');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    const formData = request.request.body as FormData;
    expect(formData.get('comicId')).toBe('changing-room');
    expect(formData.get('partId')).toBe('part-1');
    expect(formData.get('image')).toMatchObject({
      name: 'part-1-page-1.png',
      type: 'image/png',
      size: 4
    });
    request.flush({
      ok: true,
      page: '/api/hindi-comics/page?file=changing-room%2Fpart-1%2Fpage.webp',
      pageNumber: 1
    });
  });
});
