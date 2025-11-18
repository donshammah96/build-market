import { z } from 'zod';
export declare const StoreSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    address: z.ZodString;
    city: z.ZodString;
    state: z.ZodString;
    zipCode: z.ZodString;
    categories: z.ZodArray<z.ZodString>;
    verified: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const ProductSchema: z.ZodObject<{
    id: z.ZodString;
    storeId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    imageUrl: z.ZodOptional<z.ZodString>;
    category: z.ZodString;
    inStock: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type Store = z.infer<typeof StoreSchema>;
export type Product = z.infer<typeof ProductSchema>;
//# sourceMappingURL=store.d.ts.map