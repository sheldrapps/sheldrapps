/**
 * Contract for picking images from device/browser
 */
export interface IImagePicker {
  pick(): Promise<File | null>;
}

/**
 * Contract for writing files to filesystem
 */
export interface IFileWriter {
  write(path: string, data: Uint8Array | string, options?: {
    mimeType?: string;
    directory?: string;
  }): Promise<void>;
}

/**
 * Contract for reading files from filesystem
 */
export interface IFileReader {
  read(path: string, options?: {
    directory?: string;
  }): Promise<Uint8Array>;
}

/**
 * Contract for sharing files
 */
export interface IFileSharer {
  share(options: {
    title?: string;
    text?: string;
    files: string[];
  }): Promise<void>;
}
