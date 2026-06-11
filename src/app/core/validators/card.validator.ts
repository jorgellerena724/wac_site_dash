import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validator that ensures a card or account number has exactly 16 digits,
 * regardless of formatting (spaces or hyphens are allowed as separators).
 * The total field length cannot exceed 19 characters (16 digits + 3 possible separators).
 *
 * @returns A validator function that returns null if valid, or ValidationErrors if invalid
 */
export function cardAccountValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value || '';

    // Skip validation if empty (use required validator separately if needed)
    if (!value) {
      return null;
    }

    // Count only digits (ignoring spaces and hyphens)
    const digitsOnly = value.replace(/[\s-]/g, '');
    const digitCount = digitsOnly.length;

    // Check if there are exactly 16 digits
    if (digitCount !== 16) {
      return {
        cardAccount: {
          requiredDigits: 16,
          actualDigits: digitCount,
          message: `El número debe contener exactamente 16 dígitos.`,
        },
      };
    }

    // Check if the input contains only valid characters (digits, spaces, hyphens)
    if (!/^[\d\s-]+$/.test(value)) {
      return {
        cardAccount: {
          message: 'Solo se permiten dígitos, espacios y guiones.',
        },
      };
    }

    return null;
  };
}
