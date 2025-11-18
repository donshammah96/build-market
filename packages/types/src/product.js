"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryFormSchema = exports.ProductFormSchema = exports.sizes = exports.colors = void 0;
const zod_1 = __importDefault(require("zod"));
exports.colors = [
    "blue",
    "green",
    "red",
    "yellow",
    "purple",
    "orange",
    "pink",
    "brown",
    "gray",
    "black",
    "white",
];
exports.sizes = [
    "xs",
    "s",
    "m",
    "l",
    "xl",
    "xxl",
    "34",
    "35",
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
];
exports.ProductFormSchema = zod_1.default
    .object({
    name: zod_1.default
        .string({ message: "Product name is required!" })
        .min(1, { message: "Product name is required!" }),
    shortDescription: zod_1.default
        .string({ message: "Short description is required!" })
        .min(1, { message: "Short description is required!" })
        .max(60),
    description: zod_1.default
        .string({ message: "Description is required!" })
        .min(1, { message: "Description is required!" }),
    price: zod_1.default
        .number({ message: "Price is required!" })
        .min(1, { message: "Price is required!" }),
    categorySlug: zod_1.default
        .string({ message: "Category is required!" })
        .min(1, { message: "Category is required!" }),
    sizes: zod_1.default
        .array(zod_1.default.enum(exports.sizes))
        .min(1, { message: "At least one size is required!" }),
    colors: zod_1.default
        .array(zod_1.default.enum(exports.colors))
        .min(1, { message: "At least one color is required!" }),
    images: zod_1.default.record(zod_1.default.string(), zod_1.default.string(), {
        message: "Image for each color is required!",
    }),
})
    .refine((data) => {
    const missingImages = data.colors.filter((color) => !data.images?.[color]);
    return missingImages.length === 0;
}, {
    message: "Image is required for each selected color!",
    path: ["images"],
});
exports.CategoryFormSchema = zod_1.default.object({
    name: zod_1.default
        .string({ message: "Name is Required!" })
        .min(1, { message: "Name is Required!" }),
    slug: zod_1.default
        .string({ message: "Slug is Required!" })
        .min(1, { message: "Slug is Required!" }),
});
