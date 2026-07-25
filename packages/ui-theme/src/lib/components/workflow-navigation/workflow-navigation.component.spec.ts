import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkflowNavigationComponent } from './workflow-navigation.component';

describe('WorkflowNavigationComponent', () => {
  let fixture: ComponentFixture<WorkflowNavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowNavigationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowNavigationComponent);
    fixture.componentRef.setInput('previousLabel', 'Previous');
    fixture.componentRef.setInput('nextLabel', 'Next');
    fixture.detectChanges();
  });

  it('renders both actions and emits their events', () => {
    const previous = jasmine.createSpy('previous');
    const next = jasmine.createSpy('next');
    fixture.componentInstance.previous.subscribe(previous);
    fixture.componentInstance.next.subscribe(next);

    const buttons = fixture.nativeElement.querySelectorAll('ion-button');
    buttons[0].click();
    buttons[1].click();

    expect(buttons.length).toBe(2);
    expect(previous).toHaveBeenCalledOnceWith();
    expect(next).toHaveBeenCalledOnceWith();
  });

  it('hides the previous action when requested', () => {
    fixture.componentRef.setInput('showPrevious', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ion-button').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.workflow-navigation__spacer')).not.toBeNull();
  });

  it('disables the next action while loading', () => {
    fixture.componentRef.setInput('nextLoading', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('ion-button');
    expect(buttons[1].disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('ion-spinner')).not.toBeNull();
  });
});
