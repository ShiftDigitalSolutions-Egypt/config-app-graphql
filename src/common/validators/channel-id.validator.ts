import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { SessionMode } from '../enums';

export function IsChannelIdValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isChannelIdValid',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const sessionMode = (args.object as any).sessionMode;
          if (sessionMode !== SessionMode.DELIVERY_NOTE && value != null) {
            return false;
          }
          return true;
        },
        defaultMessage() {
          return 'channelId can only be provided when sessionMode is DELIVERY_NOTE';
        },
      },
    });
  };
}
