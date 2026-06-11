import { CommonModule } from '@angular/common';
import {
  Component,
  input,
  forwardRef,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  output,
  ChangeDetectorRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormGroup,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideDynamicIcon } from '@lucide/angular';
import { getLucideIcon } from '../../../core/constants/icons.constant';

@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideDynamicIcon],
  templateUrl: './app-text-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextFieldComponent),
      multi: true,
    },
  ],
})
export class TextFieldComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // Inputs usando signal inputs
  id = input<string>('');
  formatCard = input<boolean>(false);
  preventNegative = input<boolean>(false);
  label = input<string>('');
  type = input<string>('text');
  numbersOnly = input<boolean>(false);
  allowDecimals = input<boolean>(false);
  maxLength = input<number | undefined>(undefined);
  placeholder = input<string>('');
  errorMessages = input<{ [key: string]: string }>({});
  formGroup = input<FormGroup | undefined>(undefined);
  control = input<FormControl | undefined>(undefined);
  disabled = input<boolean>(false);
  errorMessage = input<string>('');
  isTextArea = input<boolean>(false);
  textAreaHeight = input<string>('h-28');
  searchMode = input<boolean>(false);
  displayValue = input<string>('');
  searchButtonClick = output<void>();
  protected readonly getIcon = getLucideIcon;

  // ViewChild para acceder a los elementos del DOM
  inputElement = viewChild<ElementRef<HTMLInputElement>>('input');
  textareaElement = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  // Signals internos
  private _value = signal<any>('');
  private _disabledState = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  hadError = signal<boolean>(false);
  private errorTracker = signal<number>(0);

  displayLabel = computed(() => {
    if (this.searchMode() && this.displayValue()) {
      return this.displayValue();
    }
    return '';
  });
  private subscribed = signal<boolean>(false);

  // Computed para combinar disabled input y estado interno
  isDisabled = computed(() => this.disabled() || this._disabledState());

  // Computed signals
  value = computed(() => this._value());

  // Computed para obtener el control correcto del FormGroup o directamente
  actualControl = computed(() => {
    const ctrl = this.control();
    if (ctrl) return ctrl;

    const fg = this.formGroup();
    const lbl = this.label();
    if (fg && lbl) {
      return fg.get(lbl) as FormControl;
    }
    return undefined;
  });

  shouldShowError = computed(() => {
    this.errorTracker();

    const ctrl = this.actualControl();
    return ctrl?.invalid && (ctrl?.dirty || ctrl?.touched);
  });

  wasFixedError = computed(() => {
    this.errorTracker();

    const ctrl = this.actualControl();
    return this.hadError() && ctrl?.valid && ctrl?.touched;
  });

  getErrorMessages = computed(() => {
    this.errorTracker();

    const customError = this.errorMessage();
    if (customError) {
      return [customError];
    }

    const ctrl = this.actualControl();
    if (!ctrl?.errors) return [];

    const customErrors = this.errorMessages();
    const defaultMessages: { [key: string]: string } = {
      required: 'Este campo es requerido',
      email: 'Email inválido',
      minlength: `Mínimo ${ctrl.errors?.['minlength']?.requiredLength} caracteres`,
      maxlength: `Máximo ${ctrl.errors?.['maxlength']?.requiredLength} caracteres`,
      pattern: 'Formato inválido',
      passwordMismatch: 'Las contraseñas no coinciden',
      warning: 'Este campo es necesario para que tenga código del sistema',
    };

    return Object.keys(ctrl.errors).map((errorKey) => {
      return customErrors[errorKey] || defaultMessages[errorKey] || 'Campo inválido';
    });
  });

  effectiveType = computed(() => {
    if (this.isTextArea()) return 'text';
    if (this.type() === 'password' && this.showPassword()) return 'text';
    return this.type();
  });

  // Callbacks para ControlValueAccessor
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Effect para sincronizar el estado disabled
    effect(() => {
      const ctrl = this.actualControl();
      const shouldDisable = this.isDisabled();

      if (ctrl && shouldDisable) {
        Promise.resolve().then(() => {
          ctrl.disable();
        });
      }
    });

    // Effect para manejar suscripciones sin duplicados
    effect(() => {
      const ctrl = this.actualControl();

      if (!ctrl) {
        this.subscribed.set(false);
        return;
      }

      if (this.subscribed()) return;

      if (ctrl.invalid && ctrl.touched) {
        this.hadError.set(true);
      }

      ctrl.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.errorTracker.update((v) => v + 1);

        if (ctrl.invalid && ctrl.touched) {
          this.hadError.set(true);
        }
      });

      ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.errorTracker.update((v) => v + 1);
      });

      this.subscribed.set(true);
    });
  }

  numberValidation(event: KeyboardEvent) {
    const allowedKeys = [
      'Backspace',
      'Tab',
      'End',
      'Home',
      'ArrowLeft',
      'ArrowRight',
      'Delete',
    ];

    if (this.numbersOnly()) {
      const isNumber = /^\d$/.test(event.key);
      if (!isNumber && !allowedKeys.includes(event.key)) {
        event.preventDefault();
      }
      return;
    }

    if (this.allowDecimals() || this.type() === 'number') {
      allowedKeys.push('.');
    }

    const isDecimal = event.key === '.' || event.key === ',';
    const isNumber = !isNaN(Number(event.key));

    if (allowedKeys.includes(event.key)) {
      if (isDecimal) {
        const input = event.target as HTMLInputElement;
        const currentValue = input.value;

        const hasDecimalSeparator =
          currentValue.includes('.') || currentValue.includes(',');

        if (hasDecimalSeparator) {
          event.preventDefault();
        }
      }
      return;
    }

    if (isNumber) {
      return;
    }

    event.preventDefault();
  }

  onBlur(): void {
    this.onTouched();

    this.errorTracker.update((v) => v + 1);

    const ctrl = this.actualControl();
    if (ctrl?.invalid && ctrl?.touched) {
      this.hadError.set(true);
    }
  }

  onCardInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');

    if (value.length > 16) {
      value = value.substring(0, 16);
    }

    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += '-';
      }
      formatted += value[i];
    }

    input.value = formatted;
    this.onChange(formatted);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    let newValue = input.value;

    if (this.allowDecimals()) {
      newValue = newValue.replace(/,/g, '.');

      const parts = newValue.split('.');
      if (parts.length > 2) {
        newValue = parts[0] + '.' + parts.slice(1).join('');
      }

      if (parts.length > 1 && parts[1].length > 2) {
        newValue = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }

    if (this.numbersOnly()) {
      newValue = newValue.replace(/[^0-9]/g, '');
    }

    const maxLen = this.maxLength();
    if (maxLen && newValue.length > maxLen) {
      newValue = newValue.substring(0, maxLen);
      input.value = newValue;

      const ctrl = this.actualControl();
      setTimeout(() => {
        ctrl?.updateValueAndValidity();
        this.errorTracker.update((v) => v + 1);
      });
    }

    if (this.formatCard()) {
      this.onCardInput(event);
    } else {
      this.onChange(newValue);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  // ControlValueAccessor methods
  writeValue(value: any): void {
    let processedValue = value;

    if (this.allowDecimals() && value) {
      processedValue = String(value).replace(/,/g, '.');
    }

    if (this.numbersOnly() && value) {
      processedValue = value.toString().replace(/[^0-9]/g, '');
    }

    const maxLen = this.maxLength();
    if (maxLen && processedValue?.length > maxLen) {
      processedValue = processedValue.substring(0, maxLen);
    }

    if (this.formatCard() && processedValue) {
      const cleaned = processedValue.replace(/[^0-9]/g, '');
      let formatted = '';
      for (let i = 0; i < cleaned.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += cleaned[i];
      }
      this._value.set(formatted);
    } else {
      this._value.set(processedValue);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabledState.set(isDisabled);
    this.cdr.markForCheck();
  }
}
