import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonIcon,
  IonInput,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import { EpubMetadataI18nService } from '../../translations/epub-metadata-i18n.service';
import { SectionCardComponent } from '../section-card/section-card.component';
import { LanguageTagSelectComponent } from '../language-tag-select/language-tag-select.component';
import {
  EPUB_METADATA_CAPABILITIES,
  type EpubMetadataCapabilities,
} from './epub-metadata-editor.capabilities';
import type {
  EpubMetadataEditorInput,
  EpubMetadataFormValue,
  EpubMetadataPerson,
} from './epub-metadata-editor.types';

type PersonFormControls = {
  name: FormControl<string>;
  role: FormControl<string>;
  fileAs: FormControl<string>;
};

type PersonFormGroup = FormGroup<PersonFormControls>;

type IdentifierFormGroup = FormGroup<{
  value: FormControl<string>;
  scheme: FormControl<string>;
}>;

type MetadataFormControls = {
  title: FormControl<string>;
  creators: FormArray<PersonFormGroup>;
  language: FormControl<string>;
  identifier: IdentifierFormGroup;
  publisher: FormControl<string>;
  date: FormControl<string>;
  description: FormControl<string>;
  subjects: FormArray<FormControl<string>>;
  contributors: FormArray<PersonFormGroup>;
  type: FormControl<string>;
  format: FormControl<string>;
  source: FormControl<string>;
  relation: FormControl<string>;
  coverage: FormControl<string>;
  rights: FormControl<string>;
};

type MetadataFormGroup = FormGroup<MetadataFormControls>;

const EMPTY_PERSON: EpubMetadataPerson = { name: '' };

const languageTagValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) {
    return null;
  }

  try {
    new Intl.Locale(value);
    return null;
  } catch {
    return { languageTag: true };
  }
};

const personNameValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const group = control as PersonFormGroup;
  const name = group.controls.name.value.trim();
  const hasMetadata =
    group.controls.role.value.trim().length > 0 ||
    group.controls.fileAs.value.trim().length > 0;

  return !name && hasMetadata ? { personNameRequired: true } : null;
};

@Component({
  selector: 'app-epub-metadata-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    IonBadge,
    IonButton,
    IonIcon,
    IonInput,
    IonTextarea,
    SectionCardComponent,
    LanguageTagSelectComponent,
  ],
  templateUrl: './epub-metadata-editor.view.html',
  styleUrls: ['./epub-metadata-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpubMetadataEditorComponent {
  readonly editorInput = input.required<EpubMetadataEditorInput>();
  readonly save = output<EpubMetadataFormValue>();


  readonly capabilities = computed<EpubMetadataCapabilities>(
    () => EPUB_METADATA_CAPABILITIES[this.editorInput().version],
  );

  readonly familyLabelKey = computed(() =>
    this.editorInput().version === 'epub2'
      ? 'EPUB_METADATA.EPUB2'
      : 'EPUB_METADATA.EPUB3',
  );
  readonly detectedVersion = computed(() => {
    const detectedVersion = this.editorInput().detectedVersion?.trim();
    return detectedVersion || (this.editorInput().version === 'epub2' ? '2' : '3');
  });

  readonly metadataForm = this.createForm();
  private readonly epubMetadataI18n = inject(EpubMetadataI18nService);

  constructor() {
    addIcons({ trashOutline });
    effect(() => {
      const editorInput = this.editorInput();
      this.populateForm(editorInput.metadata);
    });
  }

  get creators(): FormArray<PersonFormGroup> {
    return this.metadataForm.controls.creators;
  }

  get contributors(): FormArray<PersonFormGroup> {
    return this.metadataForm.controls.contributors;
  }

  get subjects(): FormArray<FormControl<string>> {
    return this.metadataForm.controls.subjects;
  }

  get identifier(): IdentifierFormGroup {
    return this.metadataForm.controls.identifier;
  }

  addCreator(): void {
    this.creators.push(this.createPersonFormGroup());
  }

  removeCreator(index: number): void {
    if (this.creators.length === 1) {
      if (!this.isPersonEmpty(this.creators.at(index))) {
        this.creators.at(index).reset(EMPTY_PERSON);
      }
      return;
    }

    this.creators.removeAt(index);
  }

  canRemoveCreator(index: number): boolean {
    return this.creators.length > 1 || !this.isPersonEmpty(this.creators.at(index));
  }

  addContributor(): void {
    this.contributors.push(this.createPersonFormGroup());
  }

  removeContributor(index: number): void {
    this.contributors.removeAt(index);
  }

  addSubject(): void {
    this.subjects.push(new FormControl('', { nonNullable: true }));
  }

  removeSubject(index: number): void {
    this.subjects.removeAt(index);
  }

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  isPersonNameInvalid(person: PersonFormGroup): boolean {
    return this.isInvalid(person.controls.name) ||
      (person.hasError('personNameRequired') && (person.touched || person.dirty));
  }

  saveMetadata(): void {
    if (this.metadataForm.invalid) {
      this.metadataForm.markAllAsTouched();
      return;
    }

    const raw = this.metadataForm.getRawValue();
    const metadata: EpubMetadataFormValue = {
      title: raw.title.trim(),
      creators: this.normalizePeople(this.creators),
      language: raw.language.trim(),
      identifier: {
        value: raw.identifier.value.trim(),
        scheme: this.optionalValue(raw.identifier.scheme),
      },
      publisher: this.optionalValue(raw.publisher),
      date: this.optionalValue(raw.date),
      description: this.optionalValue(raw.description),
      subjects: raw.subjects
        .map((subject) => subject.trim())
        .filter((subject) => subject.length > 0),
      contributors: this.normalizePeople(this.contributors),
      type: this.optionalValue(raw.type),
      format: this.optionalValue(raw.format),
      source: this.optionalValue(raw.source),
      relation: this.optionalValue(raw.relation),
      coverage: this.optionalValue(raw.coverage),
      rights: this.optionalValue(raw.rights),
    };

    this.save.emit(metadata);
  }

  private createForm(): MetadataFormGroup {
    return new FormGroup<MetadataFormControls>({
      title: new FormControl('', { nonNullable: true }),
      creators: new FormArray<PersonFormGroup>([
        this.createPersonFormGroup(),
      ]),
      language: new FormControl('', {
        nonNullable: true,
        validators: [languageTagValidator],
      }),
      identifier: new FormGroup({
        value: new FormControl('', { nonNullable: true }),
        scheme: new FormControl('', { nonNullable: true }),
      }),
      publisher: new FormControl('', { nonNullable: true }),
      date: new FormControl('', { nonNullable: true }),
      description: new FormControl('', { nonNullable: true }),
      subjects: new FormArray<FormControl<string>>([]),
      contributors: new FormArray<PersonFormGroup>([]),
      type: new FormControl('', { nonNullable: true }),
      format: new FormControl('', { nonNullable: true }),
      source: new FormControl('', { nonNullable: true }),
      relation: new FormControl('', { nonNullable: true }),
      coverage: new FormControl('', { nonNullable: true }),
      rights: new FormControl('', { nonNullable: true }),
    });
  }

  private createPersonFormGroup(person: EpubMetadataPerson = EMPTY_PERSON): PersonFormGroup {
    return new FormGroup<PersonFormControls>(
      {
        name: new FormControl(person.name ?? '', { nonNullable: true }),
        role: new FormControl(person.role ?? '', { nonNullable: true }),
        fileAs: new FormControl(person.fileAs ?? '', { nonNullable: true }),
      },
      { validators: [personNameValidator] },
    );
  }

  private populateForm(metadata: EpubMetadataFormValue): void {
    const creators = metadata.creators ?? [];
    const subjects = metadata.subjects ?? [];
    const contributors = metadata.contributors ?? [];

    this.metadataForm.patchValue({
      title: metadata.title ?? '',
      language: metadata.language ?? '',
      identifier: {
        value: metadata.identifier?.value ?? '',
        scheme: metadata.identifier?.scheme ?? '',
      },
      publisher: metadata.publisher ?? '',
      date: metadata.date ?? '',
      description: metadata.description ?? '',
      type: metadata.type ?? '',
      format: metadata.format ?? '',
      source: metadata.source ?? '',
      relation: metadata.relation ?? '',
      coverage: metadata.coverage ?? '',
      rights: metadata.rights ?? '',
    }, { emitEvent: false });

    this.replacePeople(this.creators, creators);
    this.replacePeople(this.contributors, contributors);
    this.replaceSubjects(subjects);
    this.metadataForm.markAsPristine();
    this.metadataForm.markAsUntouched();
    this.metadataForm.updateValueAndValidity({ emitEvent: false });
  }

  private replacePeople(
    formArray: FormArray<PersonFormGroup>,
    people: readonly EpubMetadataPerson[],
  ): void {
    formArray.clear({ emitEvent: false });
    const rows = people.length ? people : formArray === this.creators ? [EMPTY_PERSON] : [];
    rows.forEach((person) => formArray.push(this.createPersonFormGroup(person), { emitEvent: false }));
  }

  private replaceSubjects(subjects: readonly string[]): void {
    this.subjects.clear({ emitEvent: false });
    subjects.forEach((subject) => {
      this.subjects.push(new FormControl(subject ?? '', { nonNullable: true }), {
        emitEvent: false,
      });
    });
  }

  private normalizePeople(people: FormArray<PersonFormGroup>): EpubMetadataPerson[] {
    return people.controls
      .map((person) => ({
        name: person.controls.name.value.trim(),
        role: this.optionalValue(person.controls.role.value),
        fileAs: this.optionalValue(person.controls.fileAs.value),
      }))
      .filter((person) => Boolean(person.name || person.role || person.fileAs));
  }

  private isPersonEmpty(person: PersonFormGroup | null): boolean {
    if (!person) {
      return true;
    }

    return !(
      person.controls.name.value.trim() ||
      person.controls.role.value.trim() ||
      person.controls.fileAs.value.trim()
    );
  }

  private optionalValue(value: string | null | undefined): string | undefined {
    const normalized = value?.trim() ?? '';
    return normalized || undefined;
  }
}

