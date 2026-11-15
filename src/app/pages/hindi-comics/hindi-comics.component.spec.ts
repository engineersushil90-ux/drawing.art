import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';
import { HindiComicsComponent } from './hindi-comics.component';

describe('HindiComicsComponent', () => {
  let fixture: ComponentFixture<HindiComicsComponent>;
  let component: HindiComicsComponent;
  const drawingsService = {
    getComicPages: vi.fn(() => of([] as string[]))
  };

  beforeEach(async () => {
    drawingsService.getComicPages.mockReset();
    drawingsService.getComicPages.mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [HindiComicsComponent],
      providers: [
        provideRouter([]),
        { provide: DrawingsService, useValue: drawingsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HindiComicsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows a comic in the left menu with its parts underneath', () => {
    const sidebar = fixture.nativeElement.querySelector('.comic-sidebar') as HTMLElement;
    expect(sidebar.textContent).toContain('Changing Room');
    expect(sidebar.textContent).toContain('Part 1');
    expect(sidebar.textContent).toContain('Part 2');
  });

  it('marks new content and opens the new comic target', () => {
    const newLink = fixture.nativeElement.querySelector('.site-header nav a[aria-current="page"]') as HTMLAnchorElement;
    expect(newLink.querySelector('.new-badge')).not.toBeNull();
    expect(newLink.getAttribute('href')).toContain('comic=changing-room');
    expect(newLink.getAttribute('href')).toContain('part=part-1');
    expect(fixture.nativeElement.querySelectorAll('.comic-sidebar .new-badge')).toHaveLength(3);

    component.selectPart(component.comics[0].parts[1]);
    component.selectNewComic();

    expect(component.selectedComic?.title).toBe('Changing Room');
    expect(component.selectedPart?.title).toBe('Part 1');
  });

  it('updates the reader heading when a part is selected', () => {
    const partTwo = fixture.nativeElement.querySelectorAll('.part-link')[1] as HTMLButtonElement;
    partTwo.click();
    fixture.detectChanges();

    expect(component.selectedPart?.title).toBe('Part 2');
    expect(fixture.nativeElement.querySelector('.part-heading').textContent.trim()).toBe('Part 2');
  });

  it('navigates between parts with controls below the comic reader', () => {
    const navigation = fixture.nativeElement.querySelector('.part-navigation') as HTMLElement;
    const [previous, next] = Array.from(navigation.querySelectorAll('button')) as HTMLButtonElement[];

    expect(navigation.previousElementSibling?.classList.contains('reader-placeholder')).toBe(true);
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    fixture.detectChanges();

    expect(component.selectedPart?.title).toBe('Part 2');
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    previous.click();
    fixture.detectChanges();

    expect(component.selectedPart?.title).toBe('Part 1');
  });

  it('loads the selected part pages in order', () => {
    const pages = ['/api/hindi-comics/page?page=1', '/api/hindi-comics/page?page=2'];
    drawingsService.getComicPages.mockReturnValueOnce(of(pages));

    const partTwo = fixture.nativeElement.querySelectorAll('.part-link')[1] as HTMLButtonElement;
    partTwo.click();
    fixture.detectChanges();

    const images = fixture.nativeElement.querySelectorAll('.comic-pages img') as NodeListOf<HTMLImageElement>;
    expect(drawingsService.getComicPages).toHaveBeenLastCalledWith('changing-room', 'part-2');
    expect(Array.from(images, image => image.getAttribute('src'))).toEqual(pages);
    expect(fixture.nativeElement.textContent).not.toContain('comic pages abhi add nahi kiye gaye hain');
  });
});
