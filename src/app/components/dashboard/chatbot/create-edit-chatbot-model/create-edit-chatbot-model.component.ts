import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';

@Component({
  selector: 'app-create-edit-chatbot-model',
  templateUrl: './create-edit-chatbot-model.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditChatbotModelComponent {
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private srv = inject(ChatbotService);
  private notificationSrv = inject(NotificationService);

  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  id = signal<number>(0);
  isSubmitting = signal<boolean>(false);
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      provider: ['', Validators.required],
      daily_token_limit: ['', [Validators.required, Validators.min(1)]],
    });

    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue({
            name: data.name,
            provider: data.provider,
            daily_token_limit: data.daily_token_limit, // Agregar este campo
          });
          this.id.set(data.id || 0);
        });
      }
    });

    this.form.statusChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.formValid.emit(status === 'VALID'));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.submitError.emit();
      return;
    }

    this.isSubmitting.set(true);
    const body = {
      name: this.form.get('name')?.value,
      provider: this.form.get('provider')?.value,
      daily_token_limit: this.form.get('daily_token_limit')?.value,
    };

    const request$ =
      this.id() > 0
        ? this.srv.patchModel(body, this.id())
        : this.srv.postModel(body);

    request$.subscribe({
      next: () => {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            this.id() > 0
              ? 'notifications.chatbot_model.success.updated'
              : 'notifications.chatbot_model.success.created',
          ),
          'success',
        );
        this.submitSuccess.emit();

        const data = this.initialData();
        if (data?.onSave) data.onSave();
        if (!data?.closeOnSubmit) this.form.reset();

        this.isSubmitting.set(false);
      },
      error: (error) => {
        const msgKey =
          error.status === 400 && error.error?.detail?.includes('Ya existe')
            ? 'notifications.chatbot_model.error.duplicateName'
            : 'notifications.chatbot_model.error.create';

        this.notificationSrv.addNotification(
          this.transloco.translate(msgKey),
          'error',
        );

        this.isSubmitting.set(false);
        this.submitError.emit();
      },
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
