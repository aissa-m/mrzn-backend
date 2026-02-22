import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function IsEmailWithCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEmailWithCode',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value == null || value === '') return true;
          if (typeof value !== 'string') return false;
          const valid = EMAIL_REGEX.test(value);
          if (!valid) {
            throw new BadRequestException({
              code: 'INVALID_EMAIL',
              message: 'Invalid email format.',
            });
          }
          return true;
        },
        defaultMessage(_args: ValidationArguments) {
          return 'Invalid email format.';
        },
      },
    });
  };
}
