import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function minDateValidator(minDate: Date): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const selectedDate = new Date(control.value);
    if (isNaN(selectedDate.getTime())) {
      return { invalidDate: true }; // La fecha no es válida
    }
    return selectedDate >= minDate
      ? null
      : { minDate: { requiredDate: minDate } };
  };
}
