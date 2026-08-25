import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronForwardOutline } from 'ionicons/icons';

export type EpubDiagnosticIssueView = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  messageKey: string;
  details?: string;
};

export type EpubDiagnosticIssueTextResolver = (
  issue: EpubDiagnosticIssueView,
) => string;

export type EpubDiagnosticIssueGroupView = {
  key: string;
  primaryIssue: EpubDiagnosticIssueView;
  issues: readonly EpubDiagnosticIssueView[];
};

@Component({
  selector: 'sh-epub-diagnostic-issues',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: './epub-diagnostic-issues.component.html',
  styleUrls: ['./epub-diagnostic-issues.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpubDiagnosticIssuesComponent implements OnChanges {
  @Input() issues: readonly EpubDiagnosticIssueView[] = [];
  @Input() messageResolver: EpubDiagnosticIssueTextResolver = (issue) =>
    issue.messageKey;
  @Input() detailsResolver: EpubDiagnosticIssueTextResolver = (issue) =>
    issue.details ?? '';

  private readonly expandedIssueGroupKeys = new Set<string>();

  constructor() {
    addIcons({ chevronDownOutline, chevronForwardOutline });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['issues']) {
      this.expandedIssueGroupKeys.clear();
    }
  }

  issueSeverity(issue: EpubDiagnosticIssueView): 'critical' | 'high' | 'medium' | 'low' {
    if (issue.severity === 'error') return 'high';
    if (issue.severity === 'warning') return 'medium';
    return 'low';
  }

  issueGroups(): EpubDiagnosticIssueGroupView[] {
    const groups = new Map<string, EpubDiagnosticIssueGroupView>();

    for (const issue of this.issues) {
      const key = `issue:${issue.code}`;
      const group = groups.get(key);

      if (group) {
        group.issues = [...group.issues, issue];
        continue;
      }

      groups.set(key, {
        key,
        primaryIssue: issue,
        issues: [issue],
      });
    }

    return Array.from(groups.values());
  }

  isIssueGroupExpanded(group: EpubDiagnosticIssueGroupView): boolean {
    return this.expandedIssueGroupKeys.has(group.key);
  }

  toggleIssueGroup(group: EpubDiagnosticIssueGroupView): void {
    if (group.issues.length < 2) {
      return;
    }

    if (this.expandedIssueGroupKeys.has(group.key)) {
      this.expandedIssueGroupKeys.delete(group.key);
      return;
    }

    this.expandedIssueGroupKeys.add(group.key);
  }

  issueGroupChevronName(group: EpubDiagnosticIssueGroupView): string {
    return this.isIssueGroupExpanded(group)
      ? 'chevron-down-outline'
      : 'chevron-forward-outline';
  }

  issueGroupToggleAriaLabel(group: EpubDiagnosticIssueGroupView): string {
    return `${group.issues.length}: ${this.messageResolver(group.primaryIssue)}`;
  }

  trackGroup(_index: number, group: EpubDiagnosticIssueGroupView): string {
    return group.key;
  }

  trackIssue(index: number, issue: EpubDiagnosticIssueView): string {
    return `${issue.code}:${issue.details ?? ''}:${index}`;
  }
}
