import type { z } from "zod";

import {
  CreatePropertySchema,
  PropertyQuerySchema,
  UpdatePropertySchema,
  PropertyImageInputSchema,
  BatchCreatePropertiesSchema,
  propertyListSelect,
  propertyDetailSelect,
  PropertyAttachmentInputSchema,
  PropertyDocumentInputSchema,
  createAttachmentSchema,
  updateAttachmentSchema,
} from "@/app/lib/validation/properties-validation";

export {
  CreatePropertySchema,
  PropertyQuerySchema,
  UpdatePropertySchema,
  PropertyImageInputSchema,
  BatchCreatePropertiesSchema,
  propertyListSelect,
  propertyDetailSelect,
  PropertyAttachmentInputSchema,
  PropertyDocumentInputSchema,
  createAttachmentSchema,
  updateAttachmentSchema,
};

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof PropertyQuerySchema>;
export type PropertyImageInput = z.infer<typeof PropertyImageInputSchema>;
export type PropertyAttachmentInput = z.infer<
  typeof PropertyAttachmentInputSchema
>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
export type PropertyDocumentInput = z.infer<typeof PropertyDocumentInputSchema>;
export type PropertyListSelect = typeof propertyListSelect;
export type PropertyDetailSelect = typeof propertyDetailSelect;
