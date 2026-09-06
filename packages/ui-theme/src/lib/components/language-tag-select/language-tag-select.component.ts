import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  IonInput,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

export const COMMON_LANGUAGE_TAGS = [
  'en',
  'en-US',
  'es',
  'es-MX',
  'fr-FR',
  'de-DE',
  'it-IT',
  'pt-BR',
  'ja',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'zh-TW',
  'hi-IN',
  'ar-SA',
  'ru-RU',
] as const;

const CUSTOM_LANGUAGE_TAG = '__custom__';

@Component({
  selector: 'sh-language-tag-select',
  standalone: true,
  imports: [CommonModule, IonInput, IonSelect, IonSelectOption],
  templateUrl: './language-tag-select.component.html',
  styleUrl: './language-tag-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LanguageTagSelectComponent),
      multi: true,
    },
  ],
})
export class LanguageTagSelectComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly customOptionLabel = input.required<string>();
  readonly helperText = input<string | null>(null);

  readonly languageTags = COMMON_LANGUAGE_TAGS;

  protected selectedOption = '';
  protected customValue = '';
  protected disabled = false;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const normalizedValue = value?.trim() ?? '';
    if (COMMON_LANGUAGE_TAGS.includes(normalizedValue as (typeof COMMON_LANGUAGE_TAGS)[number])) {
      this.selectedOption = normalizedValue;
      this.customValue = '';
      return;
    }

    this.selectedOption = normalizedValue ? CUSTOM_LANGUAGE_TAG : '';
    this.customValue = normalizedValue;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onOptionChange(event: CustomEvent<{ value?: string | null }>): void {
    const value = event.detail.value ?? '';
    this.selectedOption = value;
    this.onTouched();

    if (value === CUSTOM_LANGUAGE_TAG) {
      this.onChange(this.customValue);
      return;
    }

    this.customValue = '';
    this.onChange(value);
  }

  protected onCustomValueChange(event: CustomEvent<{ value?: string | null }>): void {
    this.customValue = event.detail.value ?? '';
    this.onChange(this.customValue);
  }

  protected markAsTouched(): void {
    this.onTouched();
  }
}
