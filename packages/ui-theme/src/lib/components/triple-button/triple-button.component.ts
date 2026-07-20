import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import type { TripleButtonMode } from '../../translations/triple-button.translations';

export type { TripleButtonMode } from '../../translations/triple-button.translations';

type TripleButtonOption = {
  value: string;
  labelKey: string;
  locked: boolean;
};

@Component({
  selector: 'sh-triple-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './triple-button.component.html',
  styleUrls: ['./triple-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripleButtonComponent {
  @Input({ required: true }) mode: TripleButtonMode = 'export-quality-mode';
  @Input() selectedValue: string | null = null;
  @Input() isPro = false;
  @Input() showProBadge = false;
  @Input() proOnlyKey = 'COMMON.PRO_ONLY';
  @Output() selectedValueChange = new EventEmitter<string>();

  get titleKey(): string {
    return this.mode === 'toc-mode'
      ? 'TRIPLE_BUTTON.TOC.TITLE'
      : 'TRIPLE_BUTTON.EXPORT_QUALITY.TITLE';
  }

  get options(): readonly TripleButtonOption[] {
    if (this.mode === 'toc-mode') {
      return [
        {
          value: 'books-and-chapters',
          labelKey: 'TRIPLE_BUTTON.TOC.BOOKS_AND_CHAPTERS',
          locked: false,
        },
        {
          value: 'books-only',
          labelKey: 'TRIPLE_BUTTON.TOC.BOOKS_ONLY',
          locked: false,
        },
        {
          value: 'full-index',
          labelKey: 'TRIPLE_BUTTON.TOC.FULL_INDEX',
          locked: false,
        },
      ];
    }

    return [
      {
        value: 'thumbnail',
        labelKey: 'TRIPLE_BUTTON.EXPORT_QUALITY.THUMBNAIL',
        locked: !this.isPro,
      },
      {
        value: 'compressed',
        labelKey: 'TRIPLE_BUTTON.EXPORT_QUALITY.OPTIMIZED',
        locked: false,
      },
      {
        value: 'best',
        labelKey: 'TRIPLE_BUTTON.EXPORT_QUALITY.BEST',
        locked: !this.isPro,
      },
    ];
  }

  isSelected(value: string): boolean {
    return this.selectedValue === value;
  }

  showLockedBadge(option: TripleButtonOption): boolean {
    return this.showProBadge && option.locked;
  }

  select(value: string): void {
    if (!this.isSelected(value)) {
      this.selectedValueChange.emit(value);
    }
  }
}
