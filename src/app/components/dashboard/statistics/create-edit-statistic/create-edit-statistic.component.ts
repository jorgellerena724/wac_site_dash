import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  untracked,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
  FormArray,
} from '@angular/forms';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MetricsService } from '../../../../shared/services/features/metrics.service';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-create-edit-statistic',
  templateUrl: './create-edit-statistic.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    TooltipModule,
    SelectComponent,
    CommonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditStatisticComponent implements DynamicComponent {
  private fb = inject(FormBuilder);
  private srv = inject(MetricsService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  users = signal<any[]>([]);
  uploading = signal<boolean>(false);
  isEdit = computed(() => !!this.initialData()?.id); // config id presente

  // Formulario principal
  form: FormGroup;

  // Getter para el FormArray de eventos
  get eventsArray(): FormArray {
    return this.form.get('events') as FormArray;
  }

  constructor() {
    this.form = this.fb.group({
      id: [0],
      user_id: [null, Validators.required],
      events: this.fb.array([]),
    });

    this.isEdit = computed(() => (this.form?.get('id')?.value ?? 0) > 0);

    // Effect para cargar usuarios y datos iniciales
    effect(() => {
      const data = this.initialData();
      untracked(() => {
        if (data?.id) {
          this.form.patchValue({
            id: data.id,
            user_id: data.user?.id ?? data.user_id,
          });
        }
        this.loadUsers(data);
        if (this.isEdit() && data?.events) {
          this.initializeForEdit(data.events);
        } else {
          this.addEventRow();
        }
      });
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid && !this.uploading());
    });
  }

  // Helper para traducciones
  t(suffix: string): string {
    const prefix = 'components.statistics.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  // Carga la lista de usuarios según modo
  private loadUsers(data?: any): void {
    this.srv
      .getUsersWithoutConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((usersWithout) => {
        let userOptions = usersWithout.map((u) => ({
          value: u.id,
          label: u.client,
        }));

        // En edición, agregar el usuario actual si no está en la lista
        if (this.isEdit() && data?.user) {
          const alreadyInList = userOptions.some(
            (u) => u.value === data.user.id,
          );
          if (!alreadyInList) {
            userOptions = [
              { value: data.user.id, label: data.user.client },
              ...userOptions,
            ];
          }
        }

        this.users.set(userOptions);
      });
  }

  // Crea un grupo de controles para un evento
  createEventGroup(eventName: string = '', label: string = ''): FormGroup {
    return this.fb.group({
      event_name: [eventName, [Validators.required, Validators.minLength(3)]],
      label: [label, [Validators.required, Validators.minLength(3)]],
    });
  }

  // Añade una nueva fila de evento al formulario
  addEventRow(eventName: string = '', label: string = ''): void {
    this.eventsArray.push(this.createEventGroup(eventName, label));
  }

  // Elimina una fila de evento
  removeEventRow(index: number): void {
    this.eventsArray.removeAt(index);
  }

  private initializeForEdit(events: any[]): void {
    events.forEach((event) => this.addEventRow(event.event_name, event.label));
    if (this.eventsArray.length === 0) this.addEventRow();
  }

  // Envío del formulario
  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.statistics.error.formInvalid'),
        'warning',
      );
      this.submitError.emit();
      return;
    }

    this.uploading.set(true);

    const formData = this.form.value;

    try {
      const request$ = this.isEdit()
        ? this.srv.updateEvents(formData)
        : this.srv.createConfig(formData);

      await firstValueFrom(request$);

      this.notificationSrv.addNotification(
        this.transloco.translate(
          this.isEdit()
            ? 'notifications.statistics.success.updated'
            : 'notifications.statistics.success.created',
        ),
        'success',
      );
      this.initialData()?.onSave?.();
      this.submitSuccess.emit();
      if (!this.isEdit()) this.resetForm();
    } catch (error) {
      this.notificationSrv.addNotification(
        this.transloco.translate(
          this.isEdit()
            ? 'notifications.statistics.error.update'
            : 'notifications.statistics.error.create',
        ),
        'error',
      );
      this.submitError.emit();
    } finally {
      this.uploading.set(false);
    }
  }

  private resetForm(): void {
    if (this.isEdit()) {
    } else {
      this.form.reset();
      while (this.eventsArray.length) this.eventsArray.removeAt(0);
      this.addEventRow();
      this.form.get('user_id')?.enable();
    }
  }

  // Métodos auxiliares para el template
  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  getEventControl(index: number, controlName: string): FormControl {
    const group = this.eventsArray.at(index) as FormGroup;
    return group.get(controlName) as FormControl;
  }

  isEventExisting(index: number): boolean {
    const group = this.eventsArray.at(index) as FormGroup;
    return !!group.get('originalEvent')?.value;
  }
}
