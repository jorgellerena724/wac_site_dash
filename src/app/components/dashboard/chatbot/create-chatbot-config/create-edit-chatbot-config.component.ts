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
  FormArray,
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
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';
import { UserService } from '../../../../shared/services/users/user.service';
import { LucideDynamicIcon } from '@lucide/angular';
import { getLucideIcon } from '../../../../core/constants/icons.constant';

interface ProviderConfig {
  provider: string;
  api_key: string;
}

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
    LucideDynamicIcon,
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
  providers = signal<any[]>([]);
  isFormValid = signal(false);
  configId = signal<number | null>(null);
  isEditing = computed(() => this.configId() !== null);

  providerConfigs = signal<ProviderConfig[]>([]);
  providersFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  isSubmitting = signal<boolean>(false);
  isFormInvalid = computed(() => !this.isFormValid());

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      user_id: ['', [Validators.required]],
      prompt: ['', [Validators.required, Validators.minLength(10)]],
      temperature: [0.7, [Validators.required, Validators.min(0.1), Validators.max(1.0)]],
      providers: this.providersFormArray,
    });

    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue({
            user_id: data.user_id || data.user?.id,
            prompt: data.prompt || '',
            temperature: data.temperature || 0.7,
          });
          this.configId.set(data.id);
          if (data.models && data.models.length > 0) {
            this.loadProvidersFromData(data.models);
          }
        });
      }
    });

    effect(() => {
      this.fetchProviders();
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

  async fetchUsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userSrv.get().subscribe({
        next: (data) => {
          this.users.set(
            data.map((user: any) => ({
              value: user.id,
              label: `${user.full_name} (${user.email})`,
            })),
          );
          resolve();
        },
        error: () => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.users.error.load'),
            'error',
          );
          reject();
        },
      });
    });
  }

  async fetchProviders(): Promise<void> {
    return new Promise((resolve) => {
      this.chatbotConfigSrv.getModels().subscribe({
        next: (data) => {
          // Extraer providers únicos de los modelos
          const uniqueProviders = [...new Set(data.map((m: any) => m.provider))];
          this.providers.set(
            uniqueProviders.map((provider: string) => ({
              value: provider,
              label: provider.toUpperCase(),
            }))
          );
          resolve();
        },
        error: () => {
          this.notificationSrv.addNotification(
            'Error al cargar providers',
            'error',
          );
        },
      });
    });
  }

  private loadProvidersFromData(modelsData: any[]): void {
    this.providerConfigs.set([]);
    this.providersFormArray.clear();

    modelsData.forEach((model: any) => {
      this.addProviderConfig(model.provider, '');
    });
  }

  addProviderConfig(provider?: string, apiKey?: string): void {
    // No permitir providers duplicados
    const existingProviders = this.providerConfigs().map(p => p.provider.toLowerCase());
    if (provider && existingProviders.includes(provider.toLowerCase())) {
      return;
    }

    const providerGroup = this.fb.group({
      provider: [provider || '', Validators.required],
      api_key: [apiKey || '', [Validators.required, Validators.minLength(20)]],
    });

    this.providersFormArray.push(providerGroup);
    this.providerConfigs.update((configs) => [
      ...configs,
      { provider: provider || '', api_key: apiKey || '' },
    ]);
  }

  removeProviderConfig(index: number): void {
    this.providersFormArray.removeAt(index);
    this.providerConfigs.update((configs) => {
      const newConfigs = [...configs];
      newConfigs.splice(index, 1);
      return newConfigs;
    });
  }

  getProviderControl(index: number, field: string): FormControl {
    const providerGroup = this.providersFormArray.at(index) as FormGroup;
    return providerGroup.get(field) as FormControl;
  }

  onProviderChange(index: number, event: any): void {
    const provider = event?.value;
    // Verificar que no esté duplicado
    const otherProviders = this.providerConfigs()
      .map((c, i) => i === index ? '' : c.provider)
      .filter(p => p);
    if (otherProviders.includes(provider)) {
      this.notificationSrv.addNotification(
        'Provider ya seleccionado',
        'warning',
      );
      // Limpiar el campo
      const group = this.providersFormArray.at(index) as FormGroup;
      group.get('provider')?.setValue('');
    }
  }

  private getProvidersData(): any[] {
    const data: any[] = [];
    for (let i = 0; i < this.providersFormArray.length; i++) {
      const group = this.providersFormArray.at(i) as FormGroup;
      data.push({
        provider: group.get('provider')?.value,
        api_key: group.get('api_key')?.value?.trim(),
      });
    }
    return data;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.providersFormArray.length === 0) {
      this.notificationSrv.addNotification(
        'Formulario inválido. Agrega al menos un provider.',
        'warning',
      );
      this.submitError.emit();
      return;
    }

    for (let i = 0; i < this.providersFormArray.length; i++) {
      const group = this.providersFormArray.at(i) as FormGroup;
      if (group.get('api_key')?.value?.trim() === '') {
        this.notificationSrv.addNotification(
          'La API key es requerida para cada provider',
          'error',
        );
        this.submitError.emit();
        return;
      }
    }

    const payload = {
      user_id: this.form.get('user_id')?.value,
      models: this.getProvidersData(),
      prompt: this.form.get('prompt')?.value?.trim(),
      temperature: parseFloat(this.form.get('temperature')?.value) || 0.7,
    };

    let request$;
    if (this.isEditing() && this.configId()) {
      request$ = this.chatbotConfigSrv.patch(payload, this.configId()!);
    } else {
      request$ = this.chatbotConfigSrv.post(payload);
    }

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
      error: () => {
        this.notificationSrv.addNotification(
          this.isEditing()
            ? 'Error al actualizar'
            : 'Error al crear',
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

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}