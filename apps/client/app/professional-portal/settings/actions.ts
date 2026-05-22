"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createActionFailure,
  SecureActionError,
  secureAction,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";
import {
  professionalSettingsService,
  type ServiceGroup,
  type SettingsProfileData,
} from "@/app/lib/domains/professional-settings";
import {
  UpdateProfileSchema,
  completeProfileSchema,
  type UpdateProfileInput,
} from "@/app/lib/validation/profile-validation";

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

function toActionResponse<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: { message: string } },
): ActionResponse<T> {
  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error.message };
}

function createSettingsErrorMapper(message: string) {
  return (error: unknown) => {
    if (error instanceof SecureActionError) {
      return undefined;
    }

    return createActionFailure("internal", message, 500);
  };
}

export async function getProfessionalProfileAction(): Promise<
  ActionResponse<SettingsProfileData>
> {
  return toActionResponse(
    await secureAction<undefined, undefined, SettingsProfileData>({
      handler: async ({ actor }) =>
        unwrapResultOrThrow(
          await professionalSettingsService.getProfile({
            userId: actor!.dbUserId,
            clerkId: actor!.clerkId,
            role: actor!.role,
          }),
          "Failed to fetch profile",
        ),
      mapError: createSettingsErrorMapper("Failed to fetch profile"),
    }),
  );
}

export async function updateProfessionalProfileAction(
  input: UpdateProfileInput,
): Promise<ActionResponse> {
  return toActionResponse(
    await secureAction<UpdateProfileInput, UpdateProfileInput, void>({
      input,
      schema: UpdateProfileSchema,
      handler: async ({ actor, input: validatedInput }) => {
        unwrapResultOrThrow(
          await professionalSettingsService.updateProfile(
            {
              userId: actor!.dbUserId,
              clerkId: actor!.clerkId,
              role: actor!.role,
            },
            validatedInput,
          ),
          "Failed to update profile",
        );
        revalidatePath("/professional-portal/settings");
      },
      mapError: (error) => {
        if (error instanceof SecureActionError) {
          return undefined;
        }
        if (error instanceof z.ZodError) {
          return createActionFailure(
            "validation_error",
            "Validation failed",
            400,
          );
        }
        return createActionFailure("internal", "Failed to update profile", 500);
      },
    }),
  );
}

export async function getServicesGroupedByCategoryAction(): Promise<
  ActionResponse<ServiceGroup[]>
> {
  return toActionResponse(
    await secureAction<undefined, undefined, ServiceGroup[]>({
      requireActor: false,
      handler: async () =>
        unwrapResultOrThrow(
          await professionalSettingsService.listGroupedServices(),
          "Failed to fetch services",
        ),
      mapError: createSettingsErrorMapper("Failed to fetch services"),
    }),
  );
}

export async function completeProfessionalProfileAction(
  data: z.infer<typeof completeProfileSchema>,
): Promise<ActionResponse> {
  return toActionResponse(
    await secureAction<
      z.infer<typeof completeProfileSchema>,
      z.infer<typeof completeProfileSchema>,
      void
    >({
      input: data,
      schema: completeProfileSchema,
      handler: async ({ actor, input: validatedInput }) => {
        unwrapResultOrThrow(
          await professionalSettingsService.completeProfile(
            {
              userId: actor!.dbUserId,
              clerkId: actor!.clerkId,
              role: actor!.role,
            },
            validatedInput,
          ),
          "Failed to complete profile",
        );
        revalidatePath("/professional-portal");
      },
      mapError: (error) => {
        if (error instanceof SecureActionError) {
          return undefined;
        }
        if (error instanceof z.ZodError) {
          return createActionFailure(
            "validation_error",
            "Validation failed",
            400,
          );
        }
        return createActionFailure(
          "internal",
          "Failed to complete profile",
          500,
        );
      },
    }),
  );
}

export async function getServiceCategoriesAction(): Promise<
  ActionResponse<{ id: string; name: string }[]>
> {
  return toActionResponse(
    await secureAction<undefined, undefined, { id: string; name: string }[]>({
      requireActor: false,
      handler: async () =>
        unwrapResultOrThrow(
          await professionalSettingsService.listServiceCategories(),
          "Failed to fetch services",
        ),
      mapError: createSettingsErrorMapper("Failed to fetch services"),
    }),
  );
}
