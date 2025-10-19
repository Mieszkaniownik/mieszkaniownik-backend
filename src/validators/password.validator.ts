import { ValidatorConstraint, registerDecorator } from "class-validator";
import type {
  ValidationOptions,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "NicePassword", async: false })
export class NicePasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string): boolean {
    if (!password || password === "") {
      return true;
    }
    if (password.length < 8) {
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      return false;
    }
    if (!/[0-9]/.test(password)) {
      return false;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':'\\|,.<>/?]/.test(password)) {
      return false;
    }
    return true;
  }
  defaultMessage(): string {
    return "Password must be at least 8 characters long and contain uppercase, digit, and special character (leave empty for OAuth login)";
  }
}

export const NicePassword =
  (options?: ValidationOptions) => (object: object, propertyName: string) => {
    registerDecorator({
      name: "NicePassword",
      target: object.constructor,
      propertyName,
      options,
      validator: NicePasswordConstraint,
    });
  };
