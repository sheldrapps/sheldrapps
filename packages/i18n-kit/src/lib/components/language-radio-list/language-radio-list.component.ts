import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  SelectableButtonListComponent,
  type SelectableButtonListItem,
} from '@sheldrapps/ui-theme';

export type LanguageRadioOption = {
  code: string;
  label?: string;
  labelKey?: string;
  flagClass?: string;
  title?: string;
  titleKey?: string;
  subline?: string;
  sublineKey?: string;
  leadingIconName?: string;
  leadingIconSrc?: string;
  leadingIconClass?: string | readonly string[];
  trailingIconName?: string;
  trailingIconSrc?: string;
  trailingIconClass?: string | readonly string[];
  selectedIconName?: string;
  selectedIconSrc?: string;
  selectedIconClass?: string | readonly string[];
  ariaLabel?: string;
  ariaLabelKey?: string;
};

@Component({
  selector: 'app-language-radio-list',
  standalone: true,
  imports: [CommonModule, SelectableButtonListComponent],
  templateUrl: './language-radio-list.component.html',
  styleUrls: ['./language-radio-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageRadioListComponent implements OnChanges {
  @Input({ required: true }) options: readonly LanguageRadioOption[] = [];
  @Input({ required: true }) value: string | null = null;
  @Output() valueChange = new EventEmitter<string>();

  buttonOptions: readonly SelectableButtonListItem[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ('options' in changes) {
      this.buttonOptions = this.options.map((option) =>
        this.toButtonOption(option),
      );
    }
  }

  private toButtonOption(option: LanguageRadioOption): SelectableButtonListItem {
    return {
      value: option.code,
      title: option.title ?? option.label,
      titleKey: option.titleKey ?? option.labelKey,
      subline: option.subline,
      sublineKey: option.sublineKey,
      leadingIconClass: option.leadingIconClass ?? (
        option.flagClass
          ? ['app-language-option__flag', option.flagClass]
          : undefined
      ),
      leadingIconName: option.leadingIconName,
      leadingIconSrc: option.leadingIconSrc,
      trailingIconClass: option.trailingIconClass,
      trailingIconName: option.trailingIconName,
      trailingIconSrc: option.trailingIconSrc,
      selectedIconClass: option.selectedIconClass,
      selectedIconName: option.selectedIconName,
      selectedIconSrc: option.selectedIconSrc,
      ariaLabel: option.ariaLabel,
      ariaLabelKey: option.ariaLabelKey,
    };
  }
}
