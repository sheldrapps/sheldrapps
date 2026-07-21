import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkflowStepperComponent } from './workflow-stepper.component';
import type { WorkflowStep } from './workflow-stepper.types';

describe('WorkflowStepperComponent', () => {
  let fixture: ComponentFixture<WorkflowStepperComponent>;

  const steps: readonly WorkflowStep[] = [
    { id: 'file', label: 'File' },
    { id: 'cover', label: 'Cover' },
    { id: 'adjust', label: 'Adjust' },
    { id: 'export', label: 'Export' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowStepperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowStepperComponent);
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('currentStep', 0);
    fixture.detectChanges();
  });

  it('renders the received steps', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.workflow-stepper__label'),
    ).map((element: HTMLElement) => element.textContent?.trim());

    expect(labels).toEqual(['File', 'Cover', 'Adjust', 'Export']);
  });

  it('marks active and pending steps at the initial position', () => {
    const stepElements = fixture.nativeElement.querySelectorAll(
      '.workflow-stepper__step',
    );

    expect(stepElements[0].classList).toContain('is-active');
    expect(stepElements[1].classList).toContain('is-pending');
    expect(stepElements[2].classList).toContain('is-pending');
    expect(stepElements[3].classList).toContain('is-pending');
  });

  it('shows checks for completed steps and numbers for active and pending steps', () => {
    fixture.componentRef.setInput('currentStep', 2);
    fixture.detectChanges();

    const indicators = fixture.nativeElement.querySelectorAll(
      '.workflow-stepper__indicator',
    );

    expect(indicators[0].querySelector('ion-icon')).not.toBeNull();
    expect(indicators[1].querySelector('ion-icon')).not.toBeNull();
    expect(indicators[2].textContent.trim()).toBe('3');
    expect(indicators[3].textContent.trim()).toBe('4');
  });

  it('adds aria-current only to the active step', () => {
    fixture.componentRef.setInput('currentStep', 1);
    fixture.detectChanges();

    const activeStep = fixture.nativeElement.querySelector(
      '.workflow-stepper__step.is-active',
    );

    expect(activeStep.getAttribute('aria-current')).toBe('step');
    expect(
      fixture.nativeElement.querySelectorAll('[aria-current="step"]'),
    ).toHaveSize(1);
  });

  it('reacts when currentStep changes', () => {
    fixture.componentRef.setInput('currentStep', 3);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.workflow-stepper__step.is-completed',
      ),
    ).toHaveSize(3);
    expect(
      fixture.nativeElement.querySelector(
        '.workflow-stepper__step.is-active .workflow-stepper__indicator',
      ).textContent.trim(),
    ).toBe('4');
  });

  it('keeps a four-step layout within its host width', () => {
    const stepper = fixture.nativeElement.querySelector('.workflow-stepper');
    const list = fixture.nativeElement.querySelector('.workflow-stepper__list');

    expect(stepper.classList).not.toContain('overflow-x-auto');
    expect(list.classList).not.toContain('overflow-x-auto');
  });
});
