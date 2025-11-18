import { z } from 'zod';

export const StoreSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Store name is required'),
  description: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  categories: z.array(z.string()),
  verified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().nonnegative('Price must be non-negative'),
  imageUrl: z.string().url().optional(),
  category: z.string().min(1, 'Category is required'),
  inStock: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Store = z.infer<typeof StoreSchema>;
export type Product = z.infer<typeof ProductSchema>;
