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

  it('uses editor discard copy for editor session discard', async () => {
    const { service, resetSession, navigateBack, create } = createService();

    const confirmed = await service.confirmDiscard();

    expect(confirmed).toBeTrue();
    expect(resetSession).not.toHaveBeenCalled();
    expect(navigateBack).not.toHaveBeenCalled();
    expect(create.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        message: 'EDITOR.SHELL.CONFIRM.CANCEL_SESSION',
        buttons: [
          { text: 'EDITOR.SHELL.BUTTON.CANCEL', role: 'cancel' },
          { text: 'EDITOR.SHELL.BUTTON.DISCARD', role: 'confirm' },
        ],
      }),
    );
  });

  it('uses reset copy for host flow reset', async () => {
    const { service, create } = createService();

    const confirmed = await service.confirmResetFlow();

    expect(confirmed).toBeTrue();
    expect(create.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        message: 'UI_THEME.RESET_CONFIRMATION',
        buttons: [
          { text: 'EDITOR.SHELL.BUTTON.CANCEL', role: 'cancel' },
          { text: 'UI_THEME.RESET', role: 'confirm' },
        ],
      }),
    );
  });

  it('uses Create as the safe fallback when no valid host was recorded', () => {
    const { service, navigateBack } = createService();

    service.exitAfterDone();

    expect(navigateBack).toHaveBeenCalledOnceWith('/tabs/create');
  });
});
