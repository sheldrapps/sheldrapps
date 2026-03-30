import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DayAgendaTimelineComponent,
  type DayAgendaTimelineBoundary,
  type DayAgendaTimelineSegment,
} from '@sheldrapps/ui-theme';

@Component({
  standalone: true,
  imports: [DayAgendaTimelineComponent],
  template: `
    <sh-day-agenda-timeline
      [boundaries]="boundaries"
      [segments]="segments"
    ></sh-day-agenda-timeline>
  `,
})
class DayAgendaTimelineHostComponent {
  boundaries: DayAgendaTimelineBoundary[] = [
    { key: 'b-0', minutes: 0, label: '00:00' },
    { key: 'b-735', minutes: 735, label: '12:15' },
    { key: 'b-750', minutes: 750, label: '12:30' },
    { key: 'b-1439', minutes: 1439, label: '23:59' },
  ];

  segments: DayAgendaTimelineSegment[] = [
    {
      key: 'empty-0-735',
      type: 'empty',
      startMinutes: 0,
      endMinutes: 735,
      startBoundaryIndex: 0,
      endBoundaryIndex: 1,
      heightTier: 'empty-md',
      visualHeightPx: 48,
      hint: 'Tiempo libre',
    },
    {
      key: 'event-735-750',
      type: 'event',
      startMinutes: 735,
      endMinutes: 750,
      startBoundaryIndex: 1,
      endBoundaryIndex: 2,
      heightTier: 'event-sm',
      visualHeightPx: 32,
      title: 'Chaqueton',
      accentColor: '#10B981',
      interactive: true,
      ariaLabel: 'Chaqueton de 12:15 a 12:30',
    },
    {
      key: 'empty-750-1439',
      type: 'empty',
      startMinutes: 750,
      endMinutes: 1439,
      startBoundaryIndex: 2,
      endBoundaryIndex: 3,
      heightTier: 'empty-md',
      visualHeightPx: 48,
      hint: 'Buen momento para empezar',
    },
  ];
}

describe('DayAgendaTimelineComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [DayAgendaTimelineHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(DayAgendaTimelineHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders unique boundaries for the day', async () => {
    const fixture = await setup();
    const boundaries = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__boundary-row'
    ) as NodeListOf<HTMLElement>;

    expect(boundaries.length).toBe(4);
    expect(boundaries[0].textContent).toContain('00:00');
    expect(boundaries[1].textContent).toContain('12:15');
    expect(boundaries[2].textContent).toContain('12:30');
    expect(boundaries[3].textContent).toContain('23:59');
  });

  it('renders one body row between each pair of boundaries', async () => {
    const fixture = await setup();
    const boundaries = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__boundary-row'
    );
    const bodyRows = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__body-row'
    );

    expect(bodyRows.length).toBe(boundaries.length - 1);
  });

  it('renders boundary rulers without cross joints and uses one continuous vertical divider from timeline root', async () => {
    const fixture = await setup();
    const timeline = fixture.nativeElement.querySelector(
      '.agenda-day-timeline'
    ) as HTMLElement | null;
    const rulers = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__ruler-line'
    );
    const joints = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__joint'
    );
    const bodyRows = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__body-row'
    ) as NodeListOf<HTMLElement>;
    const boundaryRows = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__boundary-row'
    ) as NodeListOf<HTMLElement>;

    expect(timeline).not.toBeNull();
    const timelineStyle = window.getComputedStyle(timeline as HTMLElement);
    const rootDividerStyle = window.getComputedStyle(
      timeline as HTMLElement,
      '::before'
    );
    expect(timelineStyle.position).toBe('relative');
    expect(rootDividerStyle.content).not.toBe('none');
    expect(rootDividerStyle.width).toBe('1px');
    expect(rootDividerStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    expect(rulers.length).toBe(4);
    expect(joints.length).toBe(0);

    for (const boundaryRow of Array.from(boundaryRows)) {
      const boundaryDivider = boundaryRow.querySelector(
        '.agenda-day-timeline__divider-line'
      );
      expect(boundaryDivider).toBeNull();
    }

    for (const bodyRow of Array.from(bodyRows)) {
      const divider = bodyRow.querySelector(
        '.agenda-day-timeline__divider-line'
      ) as HTMLElement | null;
      expect(divider).not.toBeNull();
      const dividerStyle = window.getComputedStyle(divider as HTMLElement);
      expect(dividerStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    }
  });

  it('aligns empty and event content to the same X coordinate', async () => {
    const fixture = await setup();
    const emptyContent = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--empty .agenda-day-timeline__content'
    ) as HTMLElement | null;
    const eventContent = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--event .agenda-day-timeline__content'
    ) as HTMLElement | null;
    const tolerance = 1;

    expect(emptyContent).not.toBeNull();
    expect(eventContent).not.toBeNull();

    const emptyLeft = (emptyContent as HTMLElement).getBoundingClientRect().left;
    const eventLeft = (eventContent as HTMLElement).getBoundingClientRect().left;
    expect(Math.abs(emptyLeft - eventLeft)).toBeLessThanOrEqual(tolerance);
  });

  it('renders event title only and empty hint only', async () => {
    const fixture = await setup();
    const eventText = (
      fixture.nativeElement.querySelector(
        '.agenda-day-timeline__body--event'
      ) as HTMLElement
    ).textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const emptyText = (
      fixture.nativeElement.querySelector(
        '.agenda-day-timeline__body--empty'
      ) as HTMLElement
    ).textContent?.replace(/\s+/g, ' ').trim() ?? '';

    expect(eventText).toContain('Chaqueton');
    expect(eventText).not.toContain('min');
    expect(eventText).not.toMatch(/\b\d{2}:\d{2}\b/);
    expect(emptyText).toContain('Tiempo libre');
  });

  it('uses provided height tiers through body row visual heights', async () => {
    const fixture = await setup();
    const rows = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__body-row'
    ) as NodeListOf<HTMLElement>;

    expect(rows.length).toBe(3);

    const firstHeight = rows[0].getBoundingClientRect().height;
    const secondHeight = rows[1].getBoundingClientRect().height;
    const thirdHeight = rows[2].getBoundingClientRect().height;

    expect(firstHeight).toBeGreaterThanOrEqual(48);
    expect(secondHeight).toBeGreaterThanOrEqual(32);
    expect(thirdHeight).toBeGreaterThanOrEqual(48);
  });

  it('truncates long event titles with ellipsis', async () => {
    const fixture = await setup();
    const title = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body--event .agenda-day-timeline__title'
    ) as HTMLElement | null;

    expect(title).not.toBeNull();
    const titleStyle = window.getComputedStyle(title as HTMLElement);
    expect(titleStyle.overflow).toBe('hidden');
    expect(titleStyle.textOverflow).toBe('ellipsis');
    expect(titleStyle.whiteSpace).toBe('nowrap');
  });
});
