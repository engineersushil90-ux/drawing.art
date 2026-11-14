import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';
import { ContactComponent } from './contact.component';

describe('ContactComponent', () => {
  let fixture: ComponentFixture<ContactComponent>;
  const drawingsService = {
    submitCustomDrawingRequest: vi.fn(() => of({ ok: true }))
  };

  beforeEach(async () => {
    drawingsService.submitCustomDrawingRequest.mockClear();
    await TestBed.configureTestingModule({
      imports: [ContactComponent],
      providers: [
        provideRouter([]),
        { provide: DrawingsService, useValue: drawingsService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ContactComponent);
    fixture.detectChanges();
  });

  it('submits the custom drawing request details and shows confirmation', () => {
    const component = fixture.componentInstance;
    const request = {
      name: 'Art customer',
      email: 'customer@example.com',
      description: 'Please draw a landscape with mountains.',
      website: ''
    };
    component.request = request;

    component.submitRequest();
    fixture.detectChanges();

    expect(drawingsService.submitCustomDrawingRequest).toHaveBeenCalledWith(request, undefined);
    expect(fixture.nativeElement.textContent).toContain('Your drawing request was sent.');
  });

  it('rejects unsupported reference image types before upload', () => {
    const input = {
      files: [new File(['not an image'], 'reference.gif', { type: 'image/gif' })],
      value: 'reference.gif'
    } as unknown as HTMLInputElement;

    fixture.componentInstance.onReferenceSelected({ target: input } as unknown as Event);

    expect(fixture.componentInstance.referenceImage).toBeUndefined();
    expect(fixture.componentInstance.requestError).toBe(true);
    expect(fixture.componentInstance.requestMessage).toContain('JPG, PNG, or WebP');
  });
});
