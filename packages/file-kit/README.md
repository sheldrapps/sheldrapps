# @sheldrapps/file-kit

Reusable file system and share kit for Angular apps with Capacitor integration.

## Features

- Async file operations (read, write, delete, check existence)
- Safe filename generation and sanitization
- MIME type detection
- File sharing via Capacitor Share API
- Base64 and Uint8Array format support
- Consistent error handling

## Installation

```bash
pnpm add @sheldrapps/file-kit
```

## Usage

### Provide the kit

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideFileKit } from '@sheldrapps/file-kit';

bootstrapApplication(AppComponent, {
  providers: [
    provideFileKit()
  ]
});
```

### Use in your service

```typescript
import { Injectable, inject } from '@angular/core';
import { FileKitService } from '@sheldrapps/file-kit';

@Injectable()
export class MyFileService {
  private fileKit = inject(FileKitService);

  async saveEpub(bytes: Uint8Array, filename: string) {
    const safeFilename = this.fileKit.makeSafeFilename(filename, 'epub');
    const ref = await this.fileKit.writeBytes({
      dir: 'Documents',
      path: `MyFolder/${safeFilename}`,
      bytes,
      mimeType: 'application/epub+zip'
    });
    return ref;
  }

  async shareFile(ref: FileRef) {
    await this.fileKit.share(ref, {
      title: 'Share file',
      text: 'Check this file'
    });
  }

  async readFile(path: string) {
    const bytes = await this.fileKit.readBytes({
      dir: 'Documents',
      path
    });
    return bytes;
  }
}
```

## API

### FileKitService

#### `writeBytes(params): Promise<FileRef>`

Write bytes to a file.

- `dir`: `'Data'|'Documents'|'Cache'`
- `path`: relative path (e.g., `'MyFolder/file.bin'`)
- `bytes`: `Uint8Array`
- `mimeType`: MIME type

Returns `FileRef` with `uri`, `filename`, `mimeType`, and optional `size`.

#### `readBytes(params): Promise<Uint8Array>`

Read bytes from a file.

- `dir`: `'Data'|'Documents'|'Cache'`
- `path`: relative path

#### `delete(params): Promise<void>`

Delete a file.

#### `exists(params): Promise<boolean>`

Check if a file exists.

#### `toBase64(bytes: Uint8Array): string`

Convert bytes to base64.

#### `fromBase64(b64: string): Uint8Array`

Convert base64 to bytes.

#### `share(ref: FileRef, options?): Promise<boolean>`

Share a file using the platform's share dialog.

- `ref`: `FileRef` with uri and filename
- `options.title?`: Share dialog title
- `options.text?`: Share dialog text
- `options.dialogTitle?`: Dialog title

#### `makeSafeFilename(name: string, ext?: string): string`

Generate a safe filename.

- Removes invalid characters
- Ensures correct extension
- Limits length to 120 chars

#### `guessMimeType(filenameOrExt: string): string`

Guess MIME type from filename or extension.

- Returns MIME type or `'application/octet-stream'`

## Error Handling

Errors are wrapped in `FileKitError`:

```typescript
try {
  await fileKit.readBytes({ dir: 'Documents', path: 'missing.txt' });
} catch (error) {
  if (error instanceof FileKitError) {
    console.log(error.code); // 'NOT_FOUND', 'READ_FAILED', etc.
    console.log(error.message);
  }
}
```

## License

MIT
