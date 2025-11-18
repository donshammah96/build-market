import z from "zod";
export type Product = {
    id: string;
    name: string;
    shortDescription?: string;
    description?: string;
    price: number;
    categorySlug: string;
    sizes: readonly string[];
    colors: readonly string[];
    images: Record<string, string>;
    createdAt?: Date;
    updatedAt?: Date;
};
export type Category = {
    id: string;
    name: string;
    slug: string;
    createdAt?: Date;
    updatedAt?: Date;
};
export type ProductType = Product;
export type ProductsType = ProductType[];
export type StripeProductType = {
    id: string;
    name: string;
    price: number;
};
export declare const colors: readonly ["blue", "green", "red", "yellow", "purple", "orange", "pink", "brown", "gray", "black", "white"];
export declare const sizes: readonly ["xs", "s", "m", "l", "xl", "xxl", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"];
export declare const ProductFormSchema: z.ZodObject<{
    name: z.ZodString;
    shortDescription: z.ZodString;
    description: z.ZodString;
    price: z.ZodNumber;
    categorySlug: z.ZodString;
    sizes: z.ZodArray<z.ZodEnum<{
        xs: "xs";
        s: "s";
        m: "m";
        l: "l";
        xl: "xl";
        xxl: "xxl";
        34: "34";
        35: "35";
        36: "36";
        37: "37";
        38: "38";
        39: "39";
        40: "40";
        41: "41";
        42: "42";
        43: "43";
        44: "44";
        45: "45";
        46: "46";
        47: "47";
        48: "48";
    }>>;
    colors: z.ZodArray<z.ZodEnum<{
        blue: "blue";
        green: "green";
        red: "red";
        yellow: "yellow";
        purple: "purple";
        orange: "orange";
        pink: "pink";
        brown: "brown";
        gray: "gray";
        black: "black";
        white: "white";
    }>>;
    images: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export type CategoryType = Category;
export declare const CategoryFormSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=product.d.ts.map