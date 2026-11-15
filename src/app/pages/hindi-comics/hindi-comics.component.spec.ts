import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HindiComicsComponent } from './hindi-comics.component';

describe('HindiComicsComponent', () => {
  let fixture: ComponentFixture<HindiComicsComponent>;
  let component: HindiComicsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HindiComicsComponent],
      providers: [provideRouter([])]
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
});
