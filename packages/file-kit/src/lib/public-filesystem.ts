import { InjectionToken } from '@angular/core';
import { Filesystem } from '@capacitor/filesystem';

export type PublicFilesystem = Pick<
  typeof Filesystem,
  | 'mkdir'
  | 'readdir'
  | 'writeFile'
  | 'getUri'
  | 'deleteFile'
  | 'rename'
  | 'copy'
  | 'readFile'
  | 'stat'
>;

export const PUBLIC_FILESYSTEM = new InjectionToken<PublicFilesystem>(
  'PUBLIC_FILESYSTEM',
  { providedIn: 'root', factory: () => Filesystem },
);
