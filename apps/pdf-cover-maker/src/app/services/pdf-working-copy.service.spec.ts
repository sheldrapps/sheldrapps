import { TestBed } from '@angular/core/testing';
import { FileKitService } from '@sheldrapps/file-kit/pdf';

import { PdfWorkingCopyService } from './pdf-working-copy.service';

describe('PdfWorkingCopyService', () => {
  let service: PdfWorkingCopyService;
  let fileKit: jasmine.SpyObj<FileKitService>;

  beforeEach(() => {
    fileKit = jasmine.createSpyObj<FileKitService>('FileKitService', [
      'writeBytes',
      'exists',
      'delete',
    ]);
    fileKit.writeBytes.and.resolveTo({} as any);
    fileKit.exists.and.resolveTo(false);
    fileKit.delete.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        PdfWorkingCopyService,
        { provide: FileKitService, useValue: fileKit },
      ],
    });

    service = TestBed.inject(PdfWorkingCopyService);
  });

  it('creates sanitized .pdf working names', async () => {
    const source = new File([new Uint8Array([1, 2, 3])], 'My:*Book?.pdf', {
      type: 'application/pdf',
      lastModified: 10,
    });

    const cycle = await service.startCycle(source);

    expect(cycle.workingName.toLowerCase().endsWith('.pdf')).toBeTrue();
    expect(cycle.workingName.includes(':')).toBeFalse();
    expect(cycle.workingName.includes('*')).toBeFalse();
    expect(cycle.workingName.includes('?')).toBeFalse();
    expect(cycle.outputBaseName.toLowerCase().endsWith('.pdf')).toBeFalse();
  });

  it('resolves collisions using (n)', async () => {
    let calls = 0;
    fileKit.exists.and.callFake(async () => {
      calls += 1;
      return calls === 1;
    });

    const source = new File([new Uint8Array([7])], 'book.pdf', {
      type: 'application/pdf',
    });

    const cycle = await service.startCycle(source);
    expect(cycle.workingName).toContain(' (1).pdf');
  });

  it('cleanupWorkingCopy is best-effort', async () => {
    fileKit.delete.and.rejectWith(new Error('missing'));
    await expectAsync(
      service.cleanupWorkingCopy('pdfcovermakerWork/missing.pdf'),
    ).toBeResolved();
  });
});

