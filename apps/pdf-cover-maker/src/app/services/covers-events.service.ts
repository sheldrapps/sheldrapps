import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type CoverEvent =
  | { type: 'saved'; filename?: string }
  | { type: 'deleted'; filename?: string };

@Injectable({ providedIn: 'root' })
export class CoversEventsService {
  private readonly subj = new Subject<CoverEvent>();
  readonly events$: Observable<CoverEvent> = this.subj.asObservable();

  emit(e: CoverEvent) {
    this.subj.next(e);
  }
}
