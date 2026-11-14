import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
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

  it('explains why a short drawing description keeps submission disabled', () => {
    fixture.componentInstance.request = {
      name: 'Art customer',
      email: 'customer@example.com',
      description: 'Draw',
      website: ''
    };
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('4/15');
  });

  it('allows a short drawing description when a reference image is attached', async () => {
    const component = fixture.componentInstance;
    component.referenceImage = new File(['image'], 'reference.jpg', { type: 'image/jpeg' });
    const nameInput = fixture.nativeElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = fixture.nativeElement.querySelector('input[name="email"]') as HTMLInputElement;
    const descriptionInput = fixture.nativeElement.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
    nameInput.value = 'Art customer';
    nameInput.dispatchEvent(new Event('input'));
    emailInput.value = 'customer@example.com';
    emailInput.dispatchEvent(new Event('input'));
    descriptionInput.value = 'Draw';
    descriptionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('4/4');
  });

  it('re-enables submission and warns about possible duplicates after a timeout', () => {
    vi.useFakeTimers();
    drawingsService.submitCustomDrawingRequest.mockReturnValueOnce(NEVER);
    const component = fixture.componentInstance;
    component.request = {
      name: 'Art customer',
      email: 'customer@example.com',
      description: 'Please draw a landscape with mountains.',
      website: ''
    };

    component.submitRequest();
    expect(component.submitting).toBe(true);

    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();

    expect(component.submitting).toBe(false);
    expect(component.requestMessage).toContain('No response after 60 seconds.');
    vi.useRealTimers();
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
