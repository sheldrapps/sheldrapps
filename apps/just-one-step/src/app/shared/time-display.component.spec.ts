import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeDisplayComponent } from '@sheldrapps/ui-theme';

@Component({
  standalone: true,
  imports: [TimeDisplayComponent],
  template: `
    <div id="t00"><sh-time-display value="00:00"></sh-time-display></div>
    <div id="t11"><sh-time-display value="11:11"></sh-time-display></div>
    <div id="t12"><sh-time-display value="12:15"></sh-time-display></div>
    <div id="trange">
      <sh-time-display value="12:15 - 12:30"></sh-time-display>
    </div>
    <div id="t23"><sh-time-display value="23:59"></sh-time-display></div>
    <div id="alias"><app-time-display value="12:15"></app-time-display></div>
    <div id="invalid"><sh-time-display value="nope"></sh-time-display></div>
  `,
})
class TimeDisplayHostComponent {}

describe('TimeDisplayComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [TimeDisplayHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TimeDisplayHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<TimeDisplayHostComponent>, id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`#${id} .app-time-display`) as HTMLElement;
  }

  it('parses valid HH:mm into five fixed slots', async () => {
    const fixture = await setup();
    const root = getRoot(fixture, 't12');
    const slots = Array.from(root.querySelectorAll('.app-time-display__slot')).map(
      (node) => (node as HTMLElement).textContent ?? ''
    );

    expect(slots).toEqual(['1', '2', ':', '1', '5']);
    expect(slots.length).toBe(5);
  });

  it('keeps layout stable for invalid input', async () => {
    const fixture = await setup();
    const root = getRoot(fixture, 'invalid');
    const slots = root.querySelectorAll('.app-time-display__slot');
    const emptySlots = root.querySelectorAll('.app-time-display__slot--empty');

    expect(slots.length).toBe(5);
    expect(emptySlots.length).toBe(4);
    expect(root.textContent?.includes(':')).toBe(true);
  });

  it('renders 00:00, 11:11, 12:15 and 23:59 with equal width', async () => {
    const fixture = await setup();
    const widthFor = (id: string): number => {
      const root = getRoot(fixture, id);
      return root.getBoundingClientRect().width;
    };

    const w00 = widthFor('t00');
    const w11 = widthFor('t11');
    const w12 = widthFor('t12');
    const w23 = widthFor('t23');
    const tolerance = 1;

    expect(w00).toBeGreaterThan(0);
    expect(Math.abs(w00 - w11)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w11 - w12)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w00 - w12)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w12 - w23)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w00 - w23)).toBeLessThanOrEqual(tolerance);
  });

  it('keeps fixed slot widths for digits and separator', async () => {
    const fixture = await setup();
    const root = getRoot(fixture, 't12');
    const slots = Array.from(root.querySelectorAll('.app-time-display__slot')) as HTMLElement[];
    const widths = slots.map((slot) => slot.getBoundingClientRect().width);
    const tolerance = 1;

    expect(widths.length).toBe(5);
    expect(widths[0]).toBeGreaterThan(0);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(widths[0] - widths[3])).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(widths[0] - widths[4])).toBeLessThanOrEqual(tolerance);
    expect(widths[2]).toBeGreaterThan(0);
  });

  it('supports app-time-display selector alias with the same slot structure', async () => {
    const fixture = await setup();
    const root = getRoot(fixture, 'alias');
    const slots = root.querySelectorAll('.app-time-display__slot');

    expect(slots.length).toBe(5);
  });

  it("renders HH:mm - HH:mm as a range with range separator slot", async () => {
    const fixture = await setup();
    const root = getRoot(fixture, "trange");
    const slots = Array.from(
      root.querySelectorAll(".app-time-display__slot"),
    ).map((node) => (node as HTMLElement).textContent ?? "");
    const rangeSeparator = root.querySelector(
      ".app-time-display__slot--range-separator",
    );

    expect(slots).toEqual([
      "1",
      "2",
      ":",
      "1",
      "5",
      " - ",
      "1",
      "2",
      ":",
      "3",
      "0",
    ]);
    expect(slots.length).toBe(11);
    expect(rangeSeparator).not.toBeNull();
  });
});
