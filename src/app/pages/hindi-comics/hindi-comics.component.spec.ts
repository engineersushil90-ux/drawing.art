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

  it('updates the reader heading when a part is selected', () => {
    const partTwo = fixture.nativeElement.querySelectorAll('.part-link')[1] as HTMLButtonElement;
    partTwo.click();
    fixture.detectChanges();

    expect(component.selectedPart?.title).toBe('Part 2');
    expect(fixture.nativeElement.querySelector('.part-heading').textContent.trim()).toBe('Part 2');
  });
});
