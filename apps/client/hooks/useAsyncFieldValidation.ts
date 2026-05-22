"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { UseFormSetError, UseFormClearErrors } from "react-hook-form";

export interface UseAsyncFieldValidationOptions {
  /** Field name in the form */
  fieldName: string;
  /** Async validation function - returns error message or null if valid */
  validate: (value: string) => Promise<string | null>;
  /** RHF setError */
  setError: UseFormSetError<Record<string, unknown>>;
  /** RHF clearErrors */
  clearErrors: UseFormClearErrors<Record<string, unknown>>;
  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * Manages async validation state for a single field. Composes with RHF:
 * - RHF owns sync validation, values, errors
 * - This hook owns `validating` state only; calls setError/clearErrors to surface results
 * - Runs only after sync validation passes
 * - Aborts on unmount and on new input
 */
export function useAsyncFieldValidation({
  fieldName,
  validate,
  setError,
  clearErrors,
  debounceMs = 400,
}: UseAsyncFieldValidationOptions) {
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const runValidation = useCallback(
    async (value: string) => {
      abortRef.current = false;
      setIsValidating(true);
      try {
        const error = await validate(value);
        if (abortRef.current) return;
        if (error) {
          setError(fieldName as never, { message: error } as never);
        } else {
          clearErrors(fieldName as never);
        }
      } catch {
        if (abortRef.current) return;
        setError(
          fieldName as never,
          {
            message: "Couldn't verify — please try again.",
          } as never,
        );
      } finally {
        if (!abortRef.current) setIsValidating(false);
      }
    },
    [fieldName, validate, setError, clearErrors],
  );

  const validateField = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current = true;

      if (!value || value.trim() === "") {
        return;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        runValidation(value);
      }, debounceMs);
    },
    [runValidation, debounceMs],
  );

  const retry = useCallback(() => {
    // Caller should pass current value - this is a placeholder for retry flow
    runValidation("");
  }, [runValidation]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { isValidating, validateField, retry };
}
