import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a parameter is a valid UUID v1-v5 format.
 * Returns 400 with a clear message if the value is not a valid UUID.
 */
@Injectable()
export class UuidValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_REGEX.test(value)) {
      throw new BadRequestException(
        `Invalid UUID format: "${value}". Expected a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000).`,
      );
    }
    return value;
  }
}
