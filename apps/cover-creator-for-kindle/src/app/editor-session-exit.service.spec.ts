import { EditorSessionExitService } from '@sheldrapps/image-workflow/editor';

describe('EditorSessionExitService', () => {
  function createService(role: string = 'confirm') {
    const resetSession = jasmine.createSpy('resetSession');
    const navigateBack = jasmine
      .createSpy('navigateBack')
      .and.resolveTo(true);
    const present = jasmine.createSpy('present').and.resolveTo(undefined);
    const onWillDismiss = jasmine
      .createSpy('onWillDismiss')
      .and.resolveTo({ role });
    const create = jasmine.createSpy('create').and.resolveTo({
      present,
      onWillDismiss,
    });
    const instant = jasmine.createSpy('instant').and.callFake((key: string) => key);

    const service = new EditorSessionExitService(
      { resetSession } as never,
      { navigateBack } as never,
      { create } as never,
      { instant } as never,
    );

    return {
      service,
      resetSession,
      navigateBack,
      create,
    };
  }

  it('returns to the existing host after Done without rebuilding it', () => {
    const { service, navigateBack } = createService();
    service.setReturnUrl('/tabs/create');

    service.exitAfterDone();

    expect(navigateBack).toHaveBeenCalledOnceWith('/tabs/create');
  });

  it('returns to the existing host after confirmed Cancel', async () => {
    const { service, resetSession, navigateBack } = createService();
    service.setReturnUrl('/tabs/change');

    const cancelled = await service.cancelSession();

    expect(cancelled).toBeTrue();
    expect(resetSession).toHaveBeenCalled();
    expect(navigateBack).toHaveBeenCalledOnceWith('/tabs/change');
  });

  it('keeps the editor open when Cancel is not confirmed', async () => {
    const { service, resetSession, navigateBack } = createService('cancel');

    const cancelled = await service.cancelSession();

    expect(cancelled).toBeFalse();
    expect(resetSession).not.toHaveBeenCalled();
    expect(navigateBack).not.toHaveBeenCalled();
  });

  it('uses Create as the safe fallback when no valid host was recorded', () => {
    const { service, navigateBack } = createService();

    service.exitAfterDone();

    expect(navigateBack).toHaveBeenCalledOnceWith('/tabs/create');
  });
});
