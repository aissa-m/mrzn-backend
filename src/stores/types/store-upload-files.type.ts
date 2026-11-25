/** Archivos opcionales de marca para POST/PATCH tienda (nombres de campo multipart). */
export type StoreBrandUploadFiles = {
  logo?: Express.Multer.File[];
  banner?: Express.Multer.File[];
};
