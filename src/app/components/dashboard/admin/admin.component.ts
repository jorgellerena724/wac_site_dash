import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import {
  LucideLayoutPanelLeft,
  LucideLanguages,
  LucideList,
  LucideSmartphone,
} from '@lucide/angular';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    TranslocoModule,
    LucideLayoutPanelLeft,
    LucideLanguages,
    LucideList,
    LucideSmartphone,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {}
