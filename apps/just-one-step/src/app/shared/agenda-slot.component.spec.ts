import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgendaSlotComponent } from '@sheldrapps/ui-theme';

@Component({
  standalone: true,
  imports: [AgendaSlotComponent],
  template: `
    <div id="empty">
      <sh-agenda-slot
        startTime="00:00"
        endTime="12:15"
        type="empty"
        hint="Tiempo libre"
        heightTier="empty-md"
        [showTopLabel]="true"
        [showBottomLabel]="true"
      ></sh-agenda-slot>
    </div>
    <div id="event">
      <sh-agenda-slot
        startTime="12:15"
        endTime="12:30"
        type="event"
        title="Chaqueton"
        accentColor="#10B981"
        heightTier="event-sm"
        [showTopLabel]="true"
        [showBottomLabel]="true"
        [interactive]="true"
      ></sh-agenda-slot>
    </div>
  `,
})
class AgendaSlotHostComponent {}

describe('AgendaSlotComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AgendaSlotHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AgendaSlotHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('overlays top boundary on body start', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const topBoundary = empty.querySelector('.agenda-slot__boundary--top') as HTMLElement | null;
    const topStyles = window.getComputedStyle(topBoundary as HTMLElement);

    expect(topBoundary).not.toBeNull();
    expect(topStyles.gridRowStart).toBe('2');
    expect(topStyles.alignSelf).toBe('start');
  });

  it('overlays bottom boundary on body end', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const bottomBoundary = empty.querySelector('.agenda-slot__boundary--bottom') as HTMLElement | null;
    const bottomStyles = window.getComputedStyle(bottomBoundary as HTMLElement);

    expect(bottomBoundary).not.toBeNull();
    expect(bottomStyles.gridRowStart).toBe('2');
    expect(bottomStyles.alignSelf).toBe('end');
  });

  it('keeps slot total height aligned to body height (boundaries do not stack extra height)', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const bodyRow = empty.querySelector('.agenda-slot__body-row') as HTMLElement | null;

    expect(bodyRow).not.toBeNull();

    const slotHeight = empty.getBoundingClientRect().height;
    const bodyHeight = (bodyRow as HTMLElement).getBoundingClientRect().height;

    expect(Math.abs(slotHeight - bodyHeight)).toBeLessThanOrEqual(1);
  });

  it('renders visible horizontal boundary lines', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const topLine = empty.querySelector('.agenda-slot__boundary-line--top') as HTMLElement | null;
    const bottomLine = empty.querySelector('.agenda-slot__boundary-line--bottom') as HTMLElement | null;

    expect(topLine).not.toBeNull();
    expect(bottomLine).not.toBeNull();
    expect(Number.parseFloat(window.getComputedStyle(topLine as HTMLElement).opacity || '1')).toBeGreaterThan(0.1);
    expect(Number.parseFloat(window.getComputedStyle(bottomLine as HTMLElement).opacity || '1')).toBeGreaterThan(0.1);
  });

  it('renders visible vertical joint on boundaries', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const joints = empty.querySelectorAll('.agenda-slot__boundary-joint');

    expect(joints.length).toBe(2);
    expect(window.getComputedStyle(joints[0] as HTMLElement).height).not.toBe('0px');
  });

  it('renders vertical divider with full body height', async () => {
    const fixture = await setup();
    const event = fixture.nativeElement.querySelector('#event .agenda-slot') as HTMLElement;
    const bodyRow = event.querySelector('.agenda-slot__body-row') as HTMLElement | null;
    const divider = event.querySelector('.agenda-slot__divider-line') as HTMLElement | null;

    expect(divider).not.toBeNull();
    expect(bodyRow).not.toBeNull();

    const dividerHeight = (divider as HTMLElement).getBoundingClientRect().height;
    const bodyHeight = (bodyRow as HTMLElement).getBoundingClientRect().height;
    expect(Math.abs(dividerHeight - bodyHeight)).toBeLessThanOrEqual(1);
  });

  it('time labels cut through boundary line visually', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const topTimeBoundary = empty.querySelector('.agenda-slot__boundary-time--top') as HTMLElement | null;
    const topTimeDisplay = empty.querySelector(
      '.agenda-segment-time-slot--top sh-time-display'
    ) as HTMLElement | null;

    expect(topTimeBoundary).not.toBeNull();
    expect(topTimeDisplay).not.toBeNull();

    const styles = window.getComputedStyle(topTimeBoundary as HTMLElement);
    const zIndex = Number.parseInt(styles.zIndex || '0', 10);
    const backgroundColor = styles.backgroundColor || '';
    expect(zIndex).toBeGreaterThan(1);
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('renders event title only and empty hint only', async () => {
    const fixture = await setup();
    const emptyHint = fixture.nativeElement.querySelector(
      '#empty .agenda-slot__hint'
    ) as HTMLElement | null;
    const eventTitle = fixture.nativeElement.querySelector(
      '#event .agenda-slot__title'
    ) as HTMLElement | null;

    expect(emptyHint?.textContent).toContain('Tiempo libre');
    expect(eventTitle?.textContent).toContain('Chaqueton');
  });

  it('does not render description, duration text, or in-card time text', async () => {
    const fixture = await setup();
    const eventText = (
      fixture.nativeElement.querySelector('#event .agenda-slot__body') as HTMLElement
    ).textContent?.replace(/\s+/g, ' ').trim() ?? '';

    expect(eventText).toContain('Chaqueton');
    expect(eventText).not.toContain('min');
    expect(eventText).not.toMatch(/\b\d{2}:\d{2}\b/);
  });

  it('applies tier classes and expected heights', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const event = fixture.nativeElement.querySelector('#event .agenda-slot') as HTMLElement;
    const emptyMinHeight = Number.parseFloat(window.getComputedStyle(empty).minHeight || '0');
    const eventMinHeight = Number.parseFloat(window.getComputedStyle(event).minHeight || '0');

    expect(empty.classList.contains('agenda-slot--tier-empty-md')).toBeTrue();
    expect(event.classList.contains('agenda-slot--tier-event-sm')).toBeTrue();
    expect(emptyMinHeight).toBeGreaterThanOrEqual(84);
    expect(eventMinHeight).toBeGreaterThanOrEqual(64);
  });

  it('keeps the same structural skeleton for empty and event', async () => {
    const fixture = await setup();
    const empty = fixture.nativeElement.querySelector('#empty .agenda-slot') as HTMLElement;
    const event = fixture.nativeElement.querySelector('#event .agenda-slot') as HTMLElement;
    const selectors = [
      '.agenda-slot__boundary--top',
      '.agenda-slot__body-row',
      '.agenda-slot__divider',
      '.agenda-slot__content',
      '.agenda-slot__boundary--bottom',
    ];

    for (const selector of selectors) {
      expect(empty.querySelector(selector)).not.toBeNull();
      expect(event.querySelector(selector)).not.toBeNull();
    }
  });
});
