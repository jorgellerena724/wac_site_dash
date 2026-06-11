import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  untracked,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
  FormControl,
} from '@angular/forms';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { ContactService } from '../../../../shared/services/features/contact.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';
import { icons } from '../../../../core/constants/icons.constant';
import { toSignal } from '@angular/core/rxjs-interop';
import { getLucideIcon } from '../../../../core/constants/icons.constant';
import { LucideDynamicIcon } from '@lucide/angular';

interface SocialNetwork {
  network: string;
  url: string;
  username: string;
  active: boolean;
}

@Component({
  selector: 'app-update-contact',
  templateUrl: './update-contact.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    TooltipModule,
    ButtonModule,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateContactComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ContactService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  uploading = signal<boolean>(false);

  // Signal para redes sociales
  socialNetworks = signal<SocialNetwork[]>([]);

  // Form Array para redes sociales
  socialNetworksFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  // Formulario
  form: FormGroup;

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  // Computed para traducciones de error
  formInvalidMessage = computed(() =>
    this.transloco.translate('notifications.contact.error.formInvalid'),
  );

  updatedMessage = computed(() =>
    this.transloco.translate('notifications.contact.success.updated'),
  );

  updateErrorMessage = computed(() =>
    this.transloco.translate('notifications.contact.error.update'),
  );

  // Signals reactivos para traducciones de botones
  private disableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.disable'),
    { initialValue: '' },
  );
  private enableTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.enable'),
    { initialValue: '' },
  );

  constructor() {
    this.form = this.fb.group({
      email: [
        '',
        [Validators.required, Validators.email, Validators.minLength(3)],
      ],
      address: ['', [Validators.minLength(3)]],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          // Setear email y address
          this.form.patchValue({
            email: data.email || '',
            address: data.address || '',
          });

          this.id.set(data.id || 0);

          // Cargar redes sociales existentes
          if (data.social_networks && Array.isArray(data.social_networks)) {
            this.loadSocialNetworksFromData(data.social_networks);
          }
        });
      }
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid);
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  // Cargar redes sociales desde datos existentes
  private loadSocialNetworksFromData(socialNetworksData: any[]): void {
    this.socialNetworks.set([]);
    this.socialNetworksFormArray.clear();

    socialNetworksData.forEach((network: SocialNetwork, index: number) => {
      const networkGroup = this.fb.group({
        network: [network.network || '', Validators.required],
        url: [network.url || '', Validators.required],
        username: [network.username || ''],
        active: [network.active !== undefined ? network.active : true],
      });

      // Aplicar validación condicional basada en el estado activo
      this.updateUsernameValidation(networkGroup);

      this.socialNetworksFormArray.push(networkGroup);
      this.socialNetworks.update((networks) => [...networks, network]);

      // Suscribirse a cambios del control de URL después de agregar al array
      const urlControl = networkGroup.get('url') as FormControl;
      if (urlControl) {
        urlControl.valueChanges
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            this.onUrlChange(index);
          });
      }
    });
  }

  // Agregar una nueva red social
  addSocialNetwork(): void {
    const networkGroup = this.fb.group({
      network: ['', Validators.required],
      url: ['', Validators.required],
      username: [''],
      active: [true],
    });

    // Aplicar validación condicional
    this.updateUsernameValidation(networkGroup);

    this.socialNetworksFormArray.push(networkGroup);
    const currentIndex = this.socialNetworksFormArray.length - 1;

    // Suscribirse a cambios del control de URL después de agregar al array
    const urlControl = networkGroup.get('url') as FormControl;
    if (urlControl) {
      urlControl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.onUrlChange(currentIndex);
        });
    }

    this.socialNetworks.update((networks) => [
      ...networks,
      {
        network: '',
        url: '',
        username: '',
        active: true,
      },
    ]);
  }

  // Eliminar una red social
  removeSocialNetwork(index: number): void {
    this.socialNetworksFormArray.removeAt(index);
    this.socialNetworks.update((networks) => {
      const newNetworks = [...networks];
      newNetworks.splice(index, 1);
      return newNetworks;
    });
  }

  // Obtener control de red social
  getSocialNetworkControl(index: number, field: string): FormControl {
    const networkGroup = this.socialNetworksFormArray.at(index) as FormGroup;
    return networkGroup.get(field) as FormControl;
  }

  // Actualizar validación del campo username basado en el estado activo
  private updateUsernameValidation(networkGroup: FormGroup): void {
    const usernameControl = networkGroup.get('username');
    const activeControl = networkGroup.get('active');

    if (!usernameControl || !activeControl) return;

    // Establecer validadores condicionales
    usernameControl.clearValidators();

    if (activeControl.value) {
      usernameControl.setValidators([Validators.required]);
    }

    usernameControl.updateValueAndValidity();
  }

  // Método para alternar activo/inactivo
  toggleActive(index: number): void {
    const networkGroup = this.socialNetworksFormArray.at(index) as FormGroup;
    const activeControl = this.getSocialNetworkControl(index, 'active');
    const newValue = !activeControl.value;

    activeControl.setValue(newValue);

    // Actualizar validación del campo username
    this.updateUsernameValidation(networkGroup);
  }

  async onSubmit(): Promise<void> {
    // Validar redes sociales individualmente
    let hasInvalidNetworks = false;
    const currentNetworks = this.socialNetworks();

    for (let i = 0; i < currentNetworks.length; i++) {
      const networkGroup = this.socialNetworksFormArray.at(i) as FormGroup;
      const networkControl = this.getSocialNetworkControl(i, 'network');
      const usernameControl = this.getSocialNetworkControl(i, 'username');
      const urlControl = this.getSocialNetworkControl(i, 'url');
      const activeControl = this.getSocialNetworkControl(i, 'active');

      // Actualizar validación antes de validar
      this.updateUsernameValidation(networkGroup);

      // Marcar controles como tocados para mostrar errores
      networkControl.markAsTouched();
      urlControl.markAsTouched();

      // Solo marcar username como tocado si está activo
      if (activeControl.value) {
        usernameControl.markAsTouched();
      }

      // Validar campos básicos
      if (networkControl.invalid || urlControl.invalid) {
        hasInvalidNetworks = true;
      }

      // Validar username solo si está activo
      if (activeControl.value && usernameControl.invalid) {
        hasInvalidNetworks = true;
      }

      // Validar que la URL tenga un formato válido
      if (urlControl.value && !this.isValidUrl(urlControl.value)) {
        hasInvalidNetworks = true;
        urlControl.setErrors({ invalidUrl: true });
      }
    }

    if (this.form.invalid || hasInvalidNetworks) {
      this.notificationSrv.addNotification(
        this.formInvalidMessage(),
        'warning',
      );
      this.submitError.emit();
      return;
    }

    // Preparar FormData
    const formData = new FormData();
    formData.append('email', this.form.get('email')?.value.trim());

    // Solo agregar dirección si tiene contenido
    const addressValue = this.form.get('address')?.value?.trim();
    if (addressValue) {
      formData.append('address', addressValue);
    }

    // Construir array de redes sociales como JSON
    const socialNetworksData: SocialNetwork[] = [];
    for (let i = 0; i < this.socialNetworksFormArray.length; i++) {
      const networkGroup = this.socialNetworksFormArray.at(i) as FormGroup;

      socialNetworksData.push({
        network: networkGroup.get('network')?.value,
        url: networkGroup.get('url')?.value,
        username: networkGroup.get('username')?.value || '',
        active: networkGroup.get('active')?.value,
      });
    }

    // Agregar redes sociales como JSON string
    formData.append('social_networks', JSON.stringify(socialNetworksData));

    this.uploading.set(true);

    this.srv
      .patch(formData, this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);

          this.notificationSrv.addNotification(
            this.updatedMessage(),
            'success',
          );
          this.submitSuccess.emit();

          const data = this.initialData();
          if (data?.onSave) {
            data.onSave();
          }

          if (!data?.closeOnSubmit) {
            this.resetForm();
          }
        },
        error: (error) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.updateErrorMessage(),
            'error',
          );
          console.error('Error:', error);
          this.submitError.emit();
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  // Validar formato de URL
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Resetear formulario
  private resetForm(): void {
    this.form.reset();
    this.socialNetworks.set([]);
    this.socialNetworksFormArray.clear();
  }

  // Método para copiar URL al portapapeles
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.general.copied'),
        'success',
      );
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  }

  // Método para detectar la red social a partir de la URL
  detectNetworkFromUrl(url: string, index: number): void {
    const networkControl = this.getSocialNetworkControl(index, 'network');

    if (url.includes('whatsapp.com') || url.includes('wa.me')) {
      networkControl.setValue('whatsapp');
    } else if (url.includes('facebook.com')) {
      networkControl.setValue('facebook');
    } else if (url.includes('instagram.com')) {
      networkControl.setValue('instagram');
    } else if (url.includes('tiktok.com')) {
      networkControl.setValue('tiktok');
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      networkControl.setValue('x');
    } else if (url.includes('telegram.me') || url.includes('t.me')) {
      networkControl.setValue('telegram');
    } else if (url.includes('youtube.com')) {
      networkControl.setValue('youtube');
    } else if (url.includes('linkedin.com')) {
      networkControl.setValue('linkedin');
    } else if (url.includes('pinterest.com')) {
      networkControl.setValue('pinterest');
    } else {
      networkControl.setValue('other');
    }
  }

  // Extraer nombre de usuario de la URL
  extractUsernameFromUrl(url: string, index: number): void {
    const usernameControl = this.getSocialNetworkControl(index, 'username');

    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace('/', '');

      if (path) {
        // Eliminar @ si existe
        const username = path.startsWith('@') ? path.substring(1) : path;
        usernameControl.setValue(username);
      }
    } catch (err) {
      // Si no es una URL válida, no hacemos nada
    }
  }

  // Método para extraer usuario automáticamente cuando se cambia la URL
  onUrlChange(index: number): void {
    const urlControl = this.getSocialNetworkControl(index, 'url');
    const url = urlControl.value;

    if (url && this.isValidUrl(url)) {
      this.detectNetworkFromUrl(url, index);
      this.extractUsernameFromUrl(url, index);
    }
  }

  // Verificar si el campo username es requerido (solo cuando está activo)
  isUsernameRequired(index: number): boolean {
    const activeControl = this.getSocialNetworkControl(index, 'active');
    return activeControl.value;
  }

  // Obtener mensaje de error condicional para username
  getUsernameErrorMessage(index: number): string {
    const activeControl = this.getSocialNetworkControl(index, 'active');
    const usernameControl = this.getSocialNetworkControl(index, 'username');

    if (activeControl.value && usernameControl.hasError('required')) {
      return this.transloco.translate(
        'components.contact.edit.fields.socialNetworks.usernameRequired',
      );
    }

    return '';
  }

  // Obtener label del campo username con asterisco si es requerido
  getUsernameLabel(index: number): string {
    const baseLabel = this.transloco.translate(
      'components.contact.edit.fields.socialNetworks.username',
    );
    return this.isUsernameRequired(index) ? `${baseLabel} *` : baseLabel;
  }

  // Obtener placeholder del campo username
  getUsernamePlaceholder(index: number): string {
    const activeControl = this.getSocialNetworkControl(index, 'active');
    const key = activeControl.value
      ? 'components.contact.edit.fields.socialNetworks.usernamePlaceholderActive'
      : 'components.contact.edit.fields.socialNetworks.usernamePlaceholderInactive';
    return this.transloco.translate(key);
  }

  // Métodos para el botón de activar/desactivar
  getToggleIcon(index: number): string {
    const activeControl = this.getSocialNetworkControl(index, 'active');
    return activeControl.value ? icons['activate'] : icons['deactivate'];
  }

  getToggleTooltip(index: number): string {
    const activeControl = this.getSocialNetworkControl(index, 'active');
    return activeControl.value
      ? this.disableTranslation()
      : this.enableTranslation();
  }

  getToggleClass(index: number): string {
    const activeControl = this.getSocialNetworkControl(index, 'active');
    return activeControl.value
      ? buttonVariants.outline.gray
      : buttonVariants.outline.neutral;
  }

  getIcon(name: string): any {
    return getLucideIcon(name);
  }
}
