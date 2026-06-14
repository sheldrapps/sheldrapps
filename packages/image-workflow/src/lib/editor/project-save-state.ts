export type ProjectSaveMode = 'create' | 'overwrite' | 'copy';

function normalizeFilename(filename: string): string {
  return filename.trim().toLowerCase();
}

function firstDefinedFilename(
  ...filenames: Array<string | null | undefined>
): string | null {
  for (const filename of filenames) {
    const normalizedFilename = filename?.trim();
    if (normalizedFilename) {
      return normalizedFilename;
    }
  }

  return null;
}

function stripFilenameExtension(
  filename: string,
  extension: string,
): string {
  const normalizedFilename = filename.trim();
  const normalizedExtension = extension.trim().replace(/^\./, '');

  if (!normalizedFilename || !normalizedExtension) {
    return normalizedFilename;
  }

  const suffix = `.${normalizedExtension.toLowerCase()}`;
  if (normalizedFilename.toLowerCase().endsWith(suffix)) {
    return normalizedFilename.slice(0, -suffix.length).trim();
  }

  return normalizedFilename;
}

export class ProjectSaveState {
  private mode: ProjectSaveMode = 'create';
  private originalFilename: string | null = null;
  private currentFilename: string | null = null;

  setProject(filename: string, mode: 'overwrite' | 'copy'): void {
    const normalizedFilename = filename.trim();
    this.mode = mode;
    this.originalFilename = normalizedFilename;
    this.currentFilename = mode === 'overwrite' ? normalizedFilename : null;
  }

  clear(): void {
    this.mode = 'create';
    this.originalFilename = null;
    this.currentFilename = null;
  }

  hasProject(): boolean {
    return this.mode !== 'create';
  }

  hasCurrentFilename(): boolean {
    return !!this.currentFilename;
  }

  isOverwriteMode(): boolean {
    return this.mode === 'overwrite';
  }

  getCurrentFilename(): string | null {
    return this.currentFilename;
  }

  getOriginalFilename(): string | null {
    return this.originalFilename;
  }

  getProjectFilename(
    ...fallbackFilenames: Array<string | null | undefined>
  ): string | null {
    return (
      this.currentFilename ??
      firstDefinedFilename(...fallbackFilenames) ??
      this.originalFilename ??
      null
    );
  }

  getSuggestedFilename(
    ...fallbackFilenames: Array<string | null | undefined>
  ): string {
    return this.getProjectFilename(...fallbackFilenames) ?? 'kindle_cover';
  }

  getSuggestedBaseName(
    extension: string,
    ...fallbackFilenames: Array<string | null | undefined>
  ): string {
    return stripFilenameExtension(
      this.getSuggestedFilename(...fallbackFilenames),
      extension,
    );
  }

  getOverwriteFilename(): string | null {
    if (!this.isOverwriteMode()) {
      return null;
    }

    return this.getProjectFilename();
  }

  getFinalFilename(fallbackFilename: string): string {
    return this.currentFilename ?? this.getOverwriteFilename() ?? fallbackFilename;
  }

  isCurrentFilename(filename: string): boolean {
    if (!this.currentFilename) {
      return false;
    }

    return normalizeFilename(filename) === normalizeFilename(this.currentFilename);
  }

  setCurrentFilename(filename: string): void {
    this.currentFilename = filename.trim();
  }
}
