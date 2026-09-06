import { ChangeDetectionStrategy, Component, ViewChild, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { EpubMetadataEditorComponent } from './epub-metadata-editor.component';
import type {
  EpubMetadataEditorInput,
  EpubMetadataFormValue,
} from './epub-metadata-editor.types';

const PLAYGROUND_INPUT: EpubMetadataEditorInput = {
  version: 'epub3',
  detectedVersion: '3.3',
  fileName: 'metadata-ui-playground.epub',
  metadata: {
    title: 'Metadata UI Playground',
    creators: [
      {
        name: 'Ada Lovelace',
        role: 'aut',
        fileAs: 'Lovelace, Ada',
      },
    ],
    language: 'en',
    identifier: {
      value: 'urn:uuid:metadata-ui-playground',
      scheme: 'UUID',
    },
    publisher: 'Sheldrapps',
    date: '2026-08-30',
    description:
      'A populated sample used to refine the shared EPUB metadata editor in the browser.',
    subjects: ['EPUB', 'Metadata', 'User interface'],
    contributors: [
      {
        name: 'Charles Babbage',
        role: 'ill',
      },
    ],
    type: 'Text',
    format: 'application/epub+zip',
    source: 'https://example.com/metadata-ui-playground',
    relation: 'urn:isbn:0000000000000',
    coverage: 'Worldwide',
    rights: 'Copyright © Sheldrapps',
  },
};

@Component({
  selector: 'sh-epub-metadata-editor-playground-page',
  standalone: true,
  imports: [
    TranslateModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    EpubMetadataEditorComponent,
  ],
  templateUrl: './epub-metadata-editor-playground-page.component.html',
  styleUrls: ['./epub-metadata-editor-playground-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpubMetadataEditorPlaygroundPageComponent {
  @ViewChild('metadataEditor')
  private editor?: EpubMetadataEditorComponent;

  readonly editorInput = signal<EpubMetadataEditorInput>(PLAYGROUND_INPUT);

  onDone(): void {
    this.editor?.saveMetadata();
  }

  onSave(metadata: EpubMetadataFormValue): void {
    this.editorInput.update((input) => ({ ...input, metadata }));
  }
}