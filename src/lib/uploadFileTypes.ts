const IMAGE_EXTENSION_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  raw: 'image/raw',
  dng: 'image/x-adobe-dng',
} as const;

const LAB_EXTENSION_TO_MIME = {
  ...IMAGE_EXTENSION_TO_MIME,
  pdf: 'application/pdf',
} as const;

type UploadKind = 'image' | 'lab';

function getExtensionFromName(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) ?? '' : '';
}

function resolveMimeMap(kind: UploadKind) {
  return kind === 'lab' ? LAB_EXTENSION_TO_MIME : IMAGE_EXTENSION_TO_MIME;
}

export const IMAGE_UPLOAD_ACCEPT_ATTR =
  '.jpg,.jpeg,.png,.heic,.heif,.raw,.dng,image/jpeg,image/png,image/heic,image/heif,image/raw,image/x-adobe-dng';

export const LAB_UPLOAD_ACCEPT_ATTR =
  `${IMAGE_UPLOAD_ACCEPT_ATTR},.pdf,application/pdf`;

export function resolveUploadFileMetadata(file: File, kind: UploadKind) {
  const extension = getExtensionFromName(file.name);
  const mimeMap = resolveMimeMap(kind);
  const normalizedContentType = mimeMap[extension as keyof typeof mimeMap];

  if (!normalizedContentType) {
    return null;
  }

  return {
    extension,
    contentType: normalizedContentType,
  };
}

export function isAllowedUploadFile(file: File, kind: UploadKind) {
  return resolveUploadFileMetadata(file, kind) !== null;
}
