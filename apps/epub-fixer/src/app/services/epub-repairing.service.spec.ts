import {
  EpubRepairingService,
  type EpubRepairMatrixCase,
} from '@sheldrapps/file-kit';

describe('EpubRepairingService', () => {
  const service = new EpubRepairingService();

  it('exposes the complete repair matrix without duplicate cases', () => {
    const cases = service.listCases();

    expect(cases.length).toBe(104);
    expect(new Set(cases.map((repairCase) => repairCase.id)).size).toBe(104);

    for (const repairCase of cases) {
      expect('supportedProblem' in repairCase).toBeFalsy();
      expect('symptom' in repairCase).toBeFalsy();
      expect('solution' in repairCase).toBeFalsy();
      expect('actionLabel' in repairCase).toBeFalsy();
      expect(repairCase.actions.length).toBeGreaterThan(0);
      expect(repairCase.recommendedAction).toBe(repairCase.actions[0]);
      expect(service.getCase(repairCase.id)).toEqual(repairCase);
    }
  });

  it('summarizes the matrix by severity and action', () => {
    expect(service.summarize()).toEqual({
      totalCases: 104,
      bySeverity: {
        critical: 22,
        high: 33,
        medium: 30,
        low: 19,
      },
      byAction: {
        fix: 50,
        review_fix: 46,
        resolve: 32,
        cannot_repair: 3,
      },
      byScope: {
        opening_blocker: 33,
        optional_cleanup: 71,
      },
    });
  });

  it('maps supported runtime issues to their matrix cases', () => {
    expect(
      service.resolveDiagnosticCaseIds({ code: 'MIMETYPE_MISSING' }),
    ).toEqual(['CRIT-OCF-001']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'MIMETYPE_INVALID' }),
    ).toEqual(['CRIT-OCF-004']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'OPF_AMBIGUOUS' }),
    ).toEqual(['CRIT-CON-005']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'MANIFEST_ITEM_MISSING' }),
    ).toEqual(['HIGH-MAN-002']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'LINK_PATH_CASE_MISMATCH' }),
    ).toEqual(['HIGH-LINK-001']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'LINK_PATH_UNICODE_MISMATCH' }),
    ).toEqual(['HIGH-LINK-002']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'LINK_TARGET_MISSING' }),
    ).toEqual(['HIGH-LINK-003']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'LINK_FRAGMENT_MISSING' }),
    ).toEqual(['HIGH-LINK-004']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'ORPHAN_RESOURCE_UNUSED' }),
    ).toEqual(['LOW-MAN-001', 'LOW-MAN-002']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'SMIL_MISSING' }),
    ).toEqual(['MED-SMIL-001']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'SPINE_EMPTY' }),
    ).toEqual(['CRIT-OPF-005']);
    expect(
      service.resolveDiagnosticCaseIds({ code: 'SPINE_ITEM_INVALID' }),
    ).toEqual(['CRIT-SPINE-001']);
    expect(service.resolveDiagnosticCaseIds({ code: 'ZIP_UNREADABLE' })).toEqual([
      'CRIT-ZIP-001',
    ]);
    expect(
      service.resolveDiagnosticCaseIds({
        code: 'ZIP_CENTRAL_DIRECTORY_TRUNCATED',
      }),
    ).toEqual(['CRIT-ZIP-002']);
    expect(service.getCase('CRIT-ZIP-002')?.recommendedAction).toBe('fix');
  });

  it('treats a fixable empty spine as a reviewable repair', () => {
    expect(
      service.getRepairMode({
        code: 'SPINE_EMPTY',
        fixable: true,
      } as never),
    ).toBe('review');
  });

  it('resolves container and OPF variants using diagnostic details', () => {
    expect(
      service.resolveDiagnosticCaseIds({
        code: 'CONTAINER_MISSING',
        details: 'container.xml is missing',
      }),
    ).toEqual(['CRIT-CON-001']);
    expect(
      service.resolveDiagnosticCaseIds({
        code: 'CONTAINER_MISSING',
        details: 'container.xml is not parseable',
      }),
    ).toEqual(['CRIT-CON-002']);
    expect(
      service.resolveDiagnosticCaseIds({
        code: 'CONTAINER_MISSING',
        details: 'container.xml does not declare a rootfile',
      }),
    ).toEqual(['CRIT-CON-003']);
    expect(
      service.resolveDiagnosticCaseIds({
        code: 'OPF_MISSING',
        details: 'OEBPS/content.opf is not parseable',
      }),
    ).toEqual(['CRIT-OPF-002']);
  });

  it('returns matrix cases by severity and action', () => {
    expect(service.getCasesBySeverity('critical').length).toBe(22);
    expect(service.getCasesBySeverity('high').length).toBe(33);
    expect(service.getCasesBySeverity('medium').length).toBe(30);
    expect(service.getCasesBySeverity('low').length).toBe(19);
    expect(service.getCasesByAction('fix').length).toBeGreaterThan(0);
    expect(service.getCasesByAction('review_fix').length).toBeGreaterThan(0);
    expect(service.getCasesByScope('opening_blocker').length).toBe(33);
    expect(service.getCasesByScope('optional_cleanup').length).toBe(71);
    expect(service.getOpeningBlockerCases().length).toBe(33);
    expect(service.getOptionalCleanupCases().length).toBe(71);
  });

  it('keeps the matrix stable when a caller filters a known case', () => {
    const caseDef: EpubRepairMatrixCase | undefined = service.getCase('CRIT-CON-005');

    expect(caseDef?.recommendedAction).toBe('resolve');
    expect(caseDef?.actions).toEqual(['resolve']);
  });

  it('maps repair actions to their repair modes', () => {
    expect(service.getRepairMode('fix')).toBe('automatic');
    expect(service.getRepairMode('review_fix')).toBe('review');
    expect(service.getRepairMode('resolve')).toBe('guided');
    expect(service.getRepairMode('cannot_repair')).toBe('not_repairable');
  });
});
