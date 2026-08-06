import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';

describe('SpinnerComponent', () => {
  let fixture: ComponentFixture<SpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SpinnerComponent);
  });

  it('does not render while hidden', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sh-spinner')).toBeNull();
  });

  it('renders Crescent with accessible progress when visible', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('label', 'Loading');
    fixture.componentRef.setInput('progress', 42);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ion-spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-valuenow="42"]')).not.toBeNull();
  });

  it('does not render the percentage twice when detail repeats progress', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('detail', '42%');
    fixture.componentRef.setInput('progress', 42);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sh-spinner__detail')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sh-spinner__progress').textContent.trim()).toBe('42%');
  });

  it('keeps a distinct progress detail', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('detail', 'Archivo 2 de 5');
    fixture.componentRef.setInput('progress', 42);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sh-spinner__detail').textContent.trim()).toBe('Archivo 2 de 5');
    expect(fixture.nativeElement.querySelector('.sh-spinner__progress').textContent.trim()).toBe('42%');
  });

  it('renders the notice between the label and progress', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('label', 'Writing');
    fixture.componentRef.setInput('notice', 'Keep the app open');
    fixture.componentRef.setInput('progress', 42);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.sh-spinner__card');
    const children = [...card.children].map((child: HTMLElement) => child.className);
    expect(children).toEqual([
      'sh-spinner__indicator',
      'sh-spinner__label',
      'sh-spinner__notice',
      'sh-spinner__progress',
    ]);
  });

  it('removes the overlay when the event-driven state completes', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sh-spinner')).toBeNull();
  });
});
