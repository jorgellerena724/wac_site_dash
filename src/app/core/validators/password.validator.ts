import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null;
    }

    const hasLowerCase = /[a-z]/.test(value);
    const hasUpperCase = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecialChar = /[\/@$()\][{}|><_,.`~!%^*#\-+=?&]/.test(value);

    const errors: ValidationErrors = {};

    if (!hasLowerCase) {
      errors['noLowerCase'] = true;
    }
    if (!hasUpperCase) {
      errors['noUpperCase'] = true;
    }
    if (!hasNumber) {
      errors['noNumber'] = true;
    }
    if (!hasSpecialChar) {
      errors['noSpecialChar'] = true;
    }

    return Object.keys(errors).length === 0 ? null : errors;
  };
}
