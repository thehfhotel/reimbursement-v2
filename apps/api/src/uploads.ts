import { mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const PUBLIC_PREFIX = '/uploads';

/**
 * Persist an uploaded file under `apps/api/uploads/{uuid}.{ext}` and return
 * the public URL path the static plugin will serve it from.
 *
 * Filenames use `crypto.randomUUID()` to avoid collisions and the
 * original extension is preserved (defaulting to .bin if absent).
 */
export async function saveUploadedFile(file: File): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const originalExtension = extname(file.name).toLowerCase();
  const safeExtension = originalExtension.length > 0 ? originalExtension : '.bin';
  const filename = `${crypto.randomUUID()}${safeExtension}`;
  const absolutePath = join(UPLOADS_DIR, filename);

  await Bun.write(absolutePath, file);

  return `${PUBLIC_PREFIX}/${filename}`;
}
