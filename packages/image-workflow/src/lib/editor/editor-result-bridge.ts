import { Subscription } from 'rxjs';

import type { CropperResult } from '../types';
import type { EditorSession, EditorSessionService } from './editor-session.service';

export interface EditorResultSnapshot {
  session: EditorSession | null;
  result: CropperResult | null;
}

export async function applyEditorResultBeforeExit(
  result: CropperResult,
  apply: ((result: CropperResult) => Promise<void> | void) | undefined,
  persist: ((result: CropperResult) => Promise<void> | void) | undefined,
): Promise<void> {
  if (apply) await apply(result);
  if (persist) await persist(result);
}

export function consumeEditorResultSnapshot(
  editorSession: EditorSessionService,
  sessionId?: string,
): EditorResultSnapshot {
  const targetSessionId = sessionId ?? null;
  const session = targetSessionId
    ? editorSession.getSession(targetSessionId)
    : editorSession.getSessionForLatestResult();

  const result = targetSessionId
    ? editorSession.consumeResult(targetSessionId)
    : editorSession.consumeLatestResult();

  return { session, result };
}

export function watchEditorResultReady(
  editorSession: EditorSessionService,
  getSessionId: () => string | undefined,
  consume: (sessionId: string) => void,
): Subscription {
  return editorSession.resultReady$.subscribe((sid) => {
    if (sid !== getSessionId()) return;
    consume(sid);
  });
}
