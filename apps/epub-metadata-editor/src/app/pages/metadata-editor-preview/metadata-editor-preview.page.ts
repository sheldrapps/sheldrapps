import { ChangeDetectionStrategy, Component, QueryList, signal, ViewChildren } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { documentOutline } from 'ionicons/icons';
import {
  EpubMetadataEditorComponent,
  ActionCardComponent,
  type EpubMetadataEditorInput,
  type EpubMetadataFormValue,
} from '@sheldrapps/ui-theme';

type PreviewFile = {
  id: number;
  input: EpubMetadataEditorInput;
};

const PREVIEW_FILES: PreviewFile[] = [
  {
    id: 1,
    input: {
      version: 'epub3',
      detectedVersion: '3.3',
      fileName: 'The Long Way to a Small, Angry Planet.epub',
      metadata: {
        title: 'The Long Way to a Small, Angry Planet',
        creators: [{ name: 'Becky Chambers', role: 'aut' }],
        language: 'en',
        identifier: { value: '9780062444134', scheme: 'ISBN-13' },
        publisher: 'Harper Voyager',
        date: '2014-07-29',
        description: 'A crew travels across the galaxy to build a hyperspace tunnel.',
        subjects: ['Science fiction', 'Space travel'],
        contributors: [],
        type: 'Text',
        format: 'application/epub+zip',
        source: '',
        relation: '',
        coverage: '',
        rights: 'Copyright © Becky Chambers',
      },
    },
  },
  {
    id: 2,
    input: {
      version: 'epub3',
      detectedVersion: '3.0',
      fileName: 'A Wizard of Earthsea.epub',
      metadata: {
        title: 'A Wizard of Earthsea',
        creators: [{ name: 'Ursula K. Le Guin', role: 'aut' }],
        language: 'en',
        identifier: { value: '9780547722023', scheme: 'ISBN-13' },
        publisher: 'Houghton Mifflin Harcourt',
        date: '1968-01-01',
        description: 'A young mage learns the true name of a shadow.',
        subjects: ['Fantasy', 'Coming of age'],
        contributors: [],
        type: 'Text',
        format: 'application/epub+zip',
        source: '',
        relation: '',
        coverage: '',
        rights: 'Copyright © Ursula K. Le Guin',
      },
    },
  },
  {
    id: 3,
    input: {
      version: 'epub2',
      detectedVersion: '2.0.1',
      fileName: 'Kindred.epub',
      metadata: {
        title: 'Kindred',
        creators: [{ name: 'Octavia E. Butler', role: 'aut' }],
        language: 'en',
        identifier: { value: '9780807083697', scheme: 'ISBN-13' },
        publisher: 'Beacon Press',
        date: '1979-06-01',
        description: 'A writer is repeatedly pulled back to an antebellum plantation.',
        subjects: ['Science fiction', 'Historical fiction'],
        contributors: [],
        type: 'Text',
        format: 'application/epub+zip',
        source: '',
        relation: '',
        coverage: '',
        rights: 'Copyright © Octavia E. Butler',
      },
    },
  },
];

@Component({
  selector: 'app-metadata-editor-preview-page',
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    TranslateModule,
    EpubMetadataEditorComponent,
    ActionCardComponent,
  ],
  templateUrl: './metadata-editor-preview.page.html',
  styleUrls: ['./metadata-editor-preview.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataEditorPreviewPage {
  @ViewChildren('metadataEditor')
  private editors!: QueryList<EpubMetadataEditorComponent>;

  readonly files = signal<readonly PreviewFile[]>(PREVIEW_FILES);

  constructor() {
    addIcons({ documentOutline });
  }

  onDone(): void {
    this.editors.forEach((editor) => editor.saveMetadata());
  }

  onSave(fileId: number, metadata: EpubMetadataFormValue): void {
    this.files.update((files) =>
      files.map((file) =>
        file.id === fileId
          ? { ...file, input: { ...file.input, metadata } }
          : file,
      ),
    );
  }

  fileDisplayName(file: PreviewFile): string | null {
    return file.input.fileName?.replace(/\.epub$/i, '') ?? null;
  }

  loadMore(): void {
    const id = Math.max(...this.files().map((file) => file.id)) + 1;
    const input: EpubMetadataEditorInput = {
      ...this.files()[0].input,
      fileName: `Preview EPUB ${id}.epub`,
      metadata: {
        ...this.files()[0].input.metadata,
        title: `Preview EPUB ${id}`,
        identifier: { value: `preview-${id}`, scheme: 'UUID' },
      },
    };
    this.files.update((files) => [...files, { id, input }]);
  }
}
