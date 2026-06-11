import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { LucideMessageCircle, LucideMail, LucideGlobe } from '@lucide/angular';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    RouterModule,
    TranslocoModule,
    TooltipModule,
    LucideMessageCircle,
    LucideMail,
    LucideGlobe,
  ],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  // Computed signal para el año actual
  currentYear = computed(() => new Date().getFullYear());
}
