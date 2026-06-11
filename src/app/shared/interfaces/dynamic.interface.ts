export interface DynamicComponent {
  onSubmit(): void;
  [key: string]: any;
}
