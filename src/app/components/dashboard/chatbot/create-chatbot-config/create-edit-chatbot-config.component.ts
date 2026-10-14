import {
  Component,
  inject,
  output,
  signal,
  effect,
  computed,
  ChangeDetectionStrategy,
  input,
  untracked,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { ButtonModule } from 'primeng/button';
import {
  ChatbotConfigPayload,
  ChatbotService,
} from '../../../../shared/services/features/chatbot.service';
import { UserService } from '../../../../shared/services/users/user.service';

@Component({
  selector: 'app-create-edit-chatbot-config',
  templateUrl: './create-edit-chatbot-config.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    SelectComponent,
    ButtonModule,
  ],
})
export class CreateEditChatbotConfigComponent implements DynamicComponent {
  protected transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private chatbotConfigSrv = inject(ChatbotService);
  private userSrv = inject(UserService);
  private notificationSrv = inject(NotificationService);

  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  users = signal<any[]>([]);
  models = signal<any[]>([]);
  isFormValid = signal(false);
  configId = signal<number | null>(null);
  isEditing = computed(() => this.configId() !== null);

  isSubmitting = signal<boolean>(false);
  isFormInvalid = computed(() => !this.isFormValid());

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      user_id: ['', [Validators.required]],
      model_id: ['', [Validators.required]],
      api_key: ['', [Validators.required, Validators.minLength(20)]],
      prompt: ['', [Validators.required, Validators.minLength(10)]],
      temperature: [0.7, [Validators.required, Validators.min(0.1), Validators.max(1.0)]],
    });

    effect(() => {
      const data = this.initialData();
      if (data?.id) {
        untracked(() => {
          this.form.patchValue({
            user_id: data.user_id || data.user?.id,
            model_id: data.model_id || data.model?.id,
            prompt: data.prompt || '',
            temperature: data.temperature || 0.7,
          });
          this.configId.set(data.id);

          // El backend no devuelve la API key: al editar solo se envía si se escribe una nueva
          const apiKeyCtrl = this.form.get('api_key');
          apiKeyCtrl?.setValidators([Validators.minLength(20)]);
          apiKeyCtrl?.updateValueAndValidity();
        });
      }
    });

    effect(() => {
      this.fetchModels();
      this.fetchUsers();
    });

    effect(() => {
      const isValid = this.isFormValid();
      this.formValid.emit(isValid);
    });

    this.form.statusChanges.subscribe(() => {
      this.isFormValid.set(this.form.valid);
    });
  }

  fetchUsers(): void {
    this.userSrv.get().subscribe({
      next: (data) => {
        this.users.set(
          data.map((user: any) => ({
            value: user.id,
            label: `${user.full_name} (${user.email})`,
          })),
        );
      },
      error: () => {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.users.error.load'),
          'error',
        );
      },
    });
  }

  fetchModels(): void {
    this.chatbotConfigSrv.getModels().subscribe({
      next: (data) => {
        const options = data.map((model: any) => ({
          value: model.id,
          label: `${model.name} (${model.provider})`,
        }));

        // /models/ solo trae modelos activos: si la config editada usa uno inactivo, se agrega para mostrar su nombre
        const currentModel = untracked(() => this.initialData()?.model);
        if (currentModel && !options.some((o: any) => o.value === currentModel.id)) {
          options.push({
            value: currentModel.id,
            label: `${currentModel.name} (${currentModel.provider}) - inactivo`,
          });
        }

        this.models.set(options);
      },
      error: () => {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.chatbot_model.error.load'),
          'error',
        );
      },
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.emit();
      return;
    }

    const apiKey = this.form.get('api_key')?.value?.trim();
    const payload: Partial<ChatbotConfigPayload> = {
      user_id: this.form.get('user_id')?.value,
      model_id: this.form.get('model_id')?.value,
      prompt: this.form.get('prompt')?.value?.trim(),
      temperature: parseFloat(this.form.get('temperature')?.value) || 0.7,
    };
    if (apiKey) {
      payload.api_key = apiKey;
    }

    const request$ = this.isEditing()
      ? this.chatbotConfigSrv.patch(payload, this.configId()!)
      : this.chatbotConfigSrv.post(payload as ChatbotConfigPayload);

    request$.subscribe({
      next: () => {
        this.notificationSrv.addNotification(
          this.isEditing()
            ? 'Configuración actualizada'
            : 'Configuración creada',
          'success',
        );
        this.submitSuccess.emit();
        if (this.initialData()?.onSave) {
          this.initialData().onSave();
        }
      },
      error: (error) => {
        // Solo se muestran los mensajes de negocio del backend (ej. 409 "ya existe"), no errores internos
        const detail = error?.error?.detail;
        const isBusinessError = [400, 404, 409].includes(error?.status);
        let message = this.isEditing() ? 'Error al actualizar' : 'Error al crear';
        if (isBusinessError && typeof detail === 'string') {
          message = detail;
        }
        this.notificationSrv.addNotification(message, 'error');
        this.isSubmitting.set(false);
        this.submitError.emit();
      },
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
