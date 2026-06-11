import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private darkModeSubject = new BehaviorSubject<boolean>(false);
  darkMode$ = this.darkModeSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('darkMode') === 'true';
      this.setDarkMode(savedTheme);
    }
  }

  isDarkMode() {
    return this.darkModeSubject.value;
  }

  setDarkMode(isDark: boolean) {
    if (isPlatformBrowser(this.platformId)) {
      this.darkModeSubject.next(isDark);

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      localStorage.setItem('darkMode', isDark.toString());
    }
  }

  toggleDarkMode() {
    this.setDarkMode(!this.isDarkMode());
  }
}
