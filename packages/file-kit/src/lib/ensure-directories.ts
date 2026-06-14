import { Directory, Filesystem } from '@capacitor/filesystem';

export async function ensureDirectoriesExist(
  paths: readonly string[],
  directory = Directory.Data,
): Promise<void> {
  await Promise.all(paths.map((path) => ensureDirectoryExists(path, directory)));
}

async function ensureDirectoryExists(
  path: string,
  directory: Directory,
): Promise<void> {
  try {
    await Filesystem.mkdir({
      path,
      directory,
      recursive: true,
    });
  } catch {
    // best effort; directory may already exist or be inaccessible
  }
}
