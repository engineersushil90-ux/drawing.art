import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { DrawingsService } from '../../core/services/drawings.service';
import { AdminViewersComponent } from './admin-viewers.component';

describe('AdminViewersComponent', () => {
  let fixture: ComponentFixture<AdminViewersComponent>;
  const drawingsService = {
    adminLogin: vi.fn(() => of({ ok: true, accessToken: 'admin-token' })),
    getAdultViewers: vi.fn(() => of([{
      name: 'Test Viewer',
      email: 'viewer@example.com',
      firstViewedAt: '2026-11-14T00:00:00.000Z',
      lastViewedAt: '2026-11-14T01:00:00.000Z',
      views: 2,
      isPayment: false
    }]))
  };

  beforeEach(async () => {
    drawingsService.adminLogin.mockClear();
    drawingsService.getAdultViewers.mockClear();
    await TestBed.configureTestingModule({
      imports: [AdminViewersComponent],
      providers: [
        provideRouter([]),
        { provide: DrawingsService, useValue: drawingsService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminViewersComponent);
    fixture.detectChanges();
  });

  it('keeps names hidden until login, then shows viewer names and emails', () => {
    expect(drawingsService.adminLogin).not.toHaveBeenCalled();
    expect(drawingsService.getAdultViewers).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('viewer@example.com');

    fixture.componentInstance.username = 'owner';
    fixture.componentInstance.password = 'password';
    fixture.componentInstance.login();
    fixture.detectChanges();

    expect(drawingsService.adminLogin).toHaveBeenCalledOnce();
    expect(drawingsService.getAdultViewers).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Test Viewer');
    expect(fixture.nativeElement.textContent).toContain('viewer@example.com');
  });

  it('shows a clear credential error and re-enables sign-in', () => {
    drawingsService.adminLogin.mockReturnValueOnce(
      throwError(() => ({ status: 401 }))
    );
    fixture.componentInstance.login();
    fixture.detectChanges();

    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.message).toBe('Username or password is incorrect.');
  });

  it('cancels a stalled login and displays a timeout message', () => {
    vi.useFakeTimers();
    drawingsService.adminLogin.mockReturnValueOnce(NEVER);
    fixture.componentInstance.login();

    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.message).toContain('Login request was canceled');
    vi.useRealTimers();
  });
});
