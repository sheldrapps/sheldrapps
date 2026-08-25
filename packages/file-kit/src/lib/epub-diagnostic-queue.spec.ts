import { EpubDiagnosticQueue } from './epub-diagnostic-queue';
import { describe, expect, it } from 'vitest';

describe('EpubDiagnosticQueue', () => {
  it('runs diagnoses strictly in submission order', async () => {
    const queue = new EpubDiagnosticQueue();
    const events: string[] = [];

    const first = queue.run(async () => {
      events.push('first:start');
      await Promise.resolve();
      events.push('first:end');
      return 'first';
    });
    const second = queue.run(async () => {
      events.push('second:start');
      events.push('second:end');
      return 'second';
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      'first',
      'second',
    ]);
    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });

  it('continues after a failed diagnosis', async () => {
    const queue = new EpubDiagnosticQueue();
    const second = queue.run(async () => {
      throw new Error('first failed');
    });
    const third = queue.run(async () => 'second completed');

    await expect(second).rejects.toThrow('first failed');
    await expect(third).resolves.toBe('second completed');
  });
});
