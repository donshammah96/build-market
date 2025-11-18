import type { Product } from "./product";
import z from "zod";
export type CartItemType = Product & {
    quantity: number;
    selectedSize: string;
    selectedColor: string;
};
export type CartItemsType = CartItemType[];
export declare const shippingFormSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    address: z.ZodString;
    city: z.ZodString;
}, z.core.$strip>;
export type ShippingFormInputs = z.infer<typeof shippingFormSchema>;
export type CartStoreStateType = {
    cart: CartItemsType;
    hasHydrated: boolean;
};
export type CartStoreActionsType = {
    addToCart: (product: CartItemType) => void;
    removeFromCart: (product: CartItemType) => void;
    clearCart: () => void;
};
//# sourceMappingURL=cart.d.ts.map