import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type WithoutUndefinedValues<T extends Record<string, unknown>> = {
  [
    K in keyof T as Exclude<T[K], undefined> extends never ? never : K
  ]?: Exclude<T[K], undefined>;
};

export function omitUndefined<T extends Record<string, unknown>>(
  value: T,
): WithoutUndefinedValues<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as WithoutUndefinedValues<T>;
}
