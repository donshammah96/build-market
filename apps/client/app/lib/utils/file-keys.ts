import { randomUUID } from "node:crypto";

/**
 * Generates a collision-resistant file key for S3/Storage
 * Ensures the file extension remains at the end of the key.
 */
export function generateFileKey(folder: string, filename: string, ownerId?: string): string {
  // 1. Split filename into name and extension
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop() : ''; // Handle files with no extension safely
  const name = parts.join('.');

  // 2. Sanitize only the name part
  const sanitizedName = name
    .replace(/[^a-zA-Z0-9-]/g, '_') // Replace special chars with _
    .toLowerCase();

  // 3. Generate randomness
  const uniqueId = randomUUID(); 
  
  // 4. Reconstruct: name-UUID.ext
  // This ensures the file is still recognized as a valid type by the OS/Browser
  const finalFilename = ext 
    ? `${sanitizedName}-${uniqueId}.${ext}`
    : `${sanitizedName}-${uniqueId}`;

  // 5. Construct path
  if (ownerId) {
    return `${folder}/${ownerId}/${finalFilename}`;
  }
  
  return `${folder}/${finalFilename}`;
}