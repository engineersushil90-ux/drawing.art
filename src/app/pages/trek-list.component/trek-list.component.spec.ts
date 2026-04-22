import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrekListComponent } from './trek-list.component';

describe('TrekListComponent', () => {
  let component: TrekListComponent;
  let fixture: ComponentFixture<TrekListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrekListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrekListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
