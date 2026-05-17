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
  IonItem,
  IonLabel,
  IonRadio,
  IonRadioGroup,
} from '@ionic/angular/standalone';

export type LanguageRadioOption = {
  code: string;
  label: string;
  flagClass?: string;
};

@Component({
  selector: 'app-language-radio-list',
  standalone: true,
  imports: [CommonModule, IonRadioGroup, IonItem, IonRadio, IonLabel],
  templateUrl: './language-radio-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageRadioListComponent implements OnChanges {
  @Input({ required: true }) options: readonly LanguageRadioOption[] = [];
  @Input({ required: true }) value: string | null = null;
  @Output() valueChange = new EventEmitter<string>();
  selectedValue: string | null = null;

  trackByCode = (_: number, option: LanguageRadioOption) => option.code;

  ngOnChanges(changes: SimpleChanges): void {
    if ('value' in changes) {
      this.selectedValue = this.value;
    }
  }

  onGroupChange(next: string): void {
    this.selectValue(next);
  }

  onItemClick(next: string): void {
    this.selectValue(next);
  }

  private selectValue(next: string): void {
    this.selectedValue = next;

    if (!next || next === this.value) {
      return;
    }

    this.valueChange.emit(next);
  }
}
