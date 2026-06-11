import { Injectable, Type, signal, computed } from '@angular/core';

export interface ModalConfig {
  title: string;
  component: Type<any>;
  data?: any;
  showButtons?: boolean;
  showExpandButton?: boolean;
  width?: string;
  onClose?: () => void;
  onAccept?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  // Estado principal usando Signals
  private configSignal = signal<ModalConfig | null>(null);
  private closeRequestSignal = signal<number>(0);

  // Signals públicas
  modalConfig = computed(() => this.configSignal());
  closeRequest = computed(() => this.closeRequestSignal());

  modalWidth = computed(() => {
    const config = this.configSignal();
    if (config?.width) {
      return config.width;
    }
    return '90vw';
  });

  open(config: ModalConfig) {
    this.configSignal.set(config);
  }

  close() {
    const config = this.configSignal();
    if (config?.onClose) {
      config.onClose();
    }
    this.configSignal.set(null);
    this.closeRequestSignal.update((v) => v + 1);
  }

  accept() {
    const config = this.configSignal();
    if (config?.onAccept) {
      config.onAccept();
    }
    this.close();
  }

  // Limpiar estado
  clear() {
    this.configSignal.set(null);
  }
}
