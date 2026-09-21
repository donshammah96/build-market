import { z } from "zod";

export const stkPushResponseSchema = z.object({
  MerchantRequestID: z.string().min(1),
  CheckoutRequestID: z.string().min(1),
  ResponseCode: z.string(),
  ResponseDescription: z.string(),
  CustomerMessage: z.string().optional(),
});

export const stkQueryResponseSchema = z.object({
  ResponseCode: z.string(),
  ResponseDescription: z.string(),
  MerchantRequestID: z.string().optional(),
  CheckoutRequestID: z.string().optional(),
  ResultCode: z.string().optional(),
  ResultDesc: z.string().optional(),
});

export const oauthResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
});

export const stkCallbackSchema = z.object({
  MerchantRequestID: z.string().min(1),
  CheckoutRequestID: z.string().min(1),
  ResultCode: z.coerce.number().int(),
  ResultDesc: z.string(),
  CallbackMetadata: z
    .object({
      Item: z.array(
        z.object({
          Name: z.string(),
          Value: z.union([z.string(), z.number()]).optional(),
        }),
      ),
    })
    .optional(),
});

export const b2cResultSchema = z.object({
  Result: z.object({
    ResultType: z.coerce.number().int(),
    ResultCode: z.coerce.number().int(),
    ResultDesc: z.string(),
    OriginatorConversationID: z.string().min(1),
    ConversationID: z.string().min(1),
    TransactionID: z.string().optional(),
    ResultParameters: z
      .object({
        ResultParameter: z.array(
          z.object({
            Key: z.string(),
            Value: z.union([z.string(), z.number()]).optional(),
          }),
        ),
      })
      .optional(),
  }),
});

export const b2cInitiateResponseSchema = z.object({
  ConversationID: z.string().min(1),
  OriginatorConversationID: z.string().min(1),
  ResponseCode: z.string(),
  ResponseDescription: z.string(),
});

export const mpesaCallbackEnvelopeSchema = z.object({
  Body: z.object({
    stkCallback: stkCallbackSchema.optional(),
    Result: b2cResultSchema.shape.Result.optional(),
  }),
});

export type StkPushResponse = z.infer<typeof stkPushResponseSchema>;
export type StkQueryResponse = z.infer<typeof stkQueryResponseSchema>;
export type StkCallback = z.infer<typeof stkCallbackSchema>;
export type B2cResult = z.infer<typeof b2cResultSchema>;
