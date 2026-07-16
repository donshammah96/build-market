import { serializeDto } from "@/app/lib/api/dto-serialization";

export function toMessagingDto<T>(value: T): T {
  return serializeDto(value) as T;
}
