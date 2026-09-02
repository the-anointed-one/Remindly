import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Validates that a value, when present, is a valid phone number in international
 * (E.164) format — e.g. "+15551234567". Uses libphonenumber-js so the rule is
 * identical to the frontend's react-phone-number-input validation.
 *
 * This is meant to be paired with @IsOptional(): an empty/undefined phone is
 * allowed (phone is optional on a contact), but a *provided* number must be
 * valid. It only runs against incoming request payloads, so existing rows with
 * loosely-formatted numbers already in the database are unaffected on read.
 */
export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPhoneNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          // Optional — let @IsOptional handle absent values.
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          try {
            return isValidPhoneNumber(value);
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid phone number in international format (e.g. +15551234567)`;
        },
      },
    });
  };
}
