import {
  Injectable,
  ComponentRef,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  DestroyRef,
  inject,
} from '@angular/core';
import { ConfirmDialogComponent } from '../../components/app-confirm-dialog/app-confirm-dialog.component';

export interface ConfirmConfig {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private dialogRef: ComponentRef<ConfirmDialogComponent> | null = null;
  private destroyRef = inject(DestroyRef);
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);

  constructor() {
    // Registrar limpieza en el DestroyRef
    this.destroyRef.onDestroy(() => {
      this.cleanupDialog();
    });
  }

  async confirm(config: ConfirmConfig): Promise<boolean> {
    // Si ya existe un diálogo, destruirlo
    if (this.dialogRef) {
      this.dialogRef.destroy();
      this.dialogRef = null;
    }

    // Crear el componente dinámicamente
    this.dialogRef = createComponent(ConfirmDialogComponent, {
      environmentInjector: this.injector,
    });

    // Configurar el componente usando setInput para signals
    const instance = this.dialogRef.instance;

    // Establecer los inputs usando setInput
    this.dialogRef.setInput('title', config.title ?? 'Confirmar acción');
    this.dialogRef.setInput('message', config.message);
    this.dialogRef.setInput('confirmLabel', config.confirmLabel ?? 'Confirmar');
    this.dialogRef.setInput('cancelLabel', config.cancelLabel ?? 'Cancelar');

    // Adjuntar al DOM
    document.body.appendChild(this.dialogRef.location.nativeElement);
    this.appRef.attachView(this.dialogRef.hostView);

    try {
      // Mostrar el diálogo y esperar la respuesta
      const result = await instance.show();
      return result;
    } finally {
      // Limpiar
      this.cleanupDialog();
    }
  }

  private cleanupDialog(): void {
    if (this.dialogRef) {
      this.appRef.detachView(this.dialogRef.hostView);
      this.dialogRef.destroy();
      this.dialogRef = null;
    }
  }
}