// Uploaded illustrations are resized before being stored with the category,
// so they are included in the existing database backup.
export const MAX_CATEGORY_IMAGE_LENGTH = 350_000;
export const CATEGORY_IMAGE_DATA_PATTERN =
  /^data:image\/(?:png|jpeg|webp);base64,(?=[A-Za-z0-9+/])(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function isCategoryImageData(value: string) {
  return value.startsWith("data:image/");
}

export function categoryImageSource(value: string) {
  return isCategoryImageData(value)
    ? value
    : `/illustrations/categories/${value}.webp`;
}
