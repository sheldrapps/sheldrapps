import { ChangeDetectorRef, ElementRef, SimpleChange } from '@angular/core';
import { ScrollableButtonBarComponent } from '@sheldrapps/ui-theme';

describe('ScrollableButtonBarComponent interaction contract', () => {
  let component: ScrollableButtonBarComponent;
  let scrollElement: HTMLDivElement;

  beforeEach(() => {
    scrollElement = document.createElement('div');
    component = new ScrollableButtonBarComponent(
      new ElementRef(document.createElement('div')),
      {
        markForCheck: jasmine.createSpy('markForCheck'),
      } as unknown as ChangeDetectorRef,
    );
    component.scrollElRef = new ElementRef(scrollElement);
  });

  it('does not replay the overflow hint when item references change without content changes', () => {
    const implementation = component as any;
    const previousItems = [{ id: 'crop', label: 'Crop' }];
    const equivalentItems = [{ id: 'crop', label: 'Crop' }];

    component.items = previousItems;
    implementation.viewReady = true;
    implementation.itemsSignature = implementation.getItemsSignature();
    implementation.didNudge = true;
    spyOn(globalThis, 'requestAnimationFrame').and.returnValue(0);

    component.items = equivalentItems;
    component.ngOnChanges({
      items: new SimpleChange(previousItems, equivalentItems, false),
    });

    expect(implementation.didNudge).toBeTrue();
  });

  it('keeps the one-time overflow hint for genuinely overflowing content', () => {
    const implementation = component as any;
    const requestAnimationFrameSpy = spyOn(
      globalThis,
      'requestAnimationFrame',
    ).and.returnValue(7);

    Object.defineProperty(scrollElement, 'clientWidth', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(scrollElement, 'scrollWidth', {
      configurable: true,
      value: 240,
    });

    implementation.nudgeOnce();

    expect(implementation.didNudge).toBeTrue();
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });

  it('starts the overflow hint when a delayed measurement first finds overflow', () => {
    const implementation = component as any;
    const frames: FrameRequestCallback[] = [];

    Object.defineProperty(scrollElement, 'clientWidth', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(scrollElement, 'scrollWidth', {
      configurable: true,
      value: 240,
    });
    implementation.viewReady = true;
    spyOn(globalThis, 'requestAnimationFrame').and.callFake((callback) => {
      frames.push(callback);
      return frames.length;
    });

    implementation.scheduleRecalculate(false);
    frames.shift()?.(0);

    expect(implementation.didNudge).toBeTrue();
  });

  it('leaves touch panning to native overflow scrolling and cancels the hint', () => {
    const implementation = component as any;
    const cancelAnimationFrameSpy = spyOn(
      globalThis,
      'cancelAnimationFrame',
    );
    const capturePointerSpy = spyOn(scrollElement, 'setPointerCapture');

    implementation.hasOverflow = true;
    implementation.nudgeRafId = 12;
    implementation.onPointerDown({
      pointerType: 'touch',
      button: 0,
      pointerId: 1,
      clientX: 0,
    } as PointerEvent);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(12);
    expect(capturePointerSpy).not.toHaveBeenCalled();
  });

  it('keeps mouse dragging available when scrollbars are hidden', () => {
    const implementation = component as any;
    const capturePointerSpy = spyOn(scrollElement, 'setPointerCapture');

    implementation.hasOverflow = true;
    implementation.onPointerDown({
      pointerType: 'mouse',
      button: 0,
      pointerId: 9,
      clientX: 180,
    } as PointerEvent);

    expect(capturePointerSpy).toHaveBeenCalledWith(9);
    expect(implementation.dragActive).toBeTrue();
  });
});
