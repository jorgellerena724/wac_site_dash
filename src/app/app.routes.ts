import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () =>
      import('./components/dashboard/admin/admin.component').then(
        (m) => m.AdminComponent,
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'statistics',
    loadComponent: () =>
      import('./components/dashboard/statistics/charts-statistics/charts-statistics.component').then(
        (m) => m.ChartsStatisticsComponent,
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'statistics-config',
    loadComponent: () =>
      import('./components/dashboard/statistics/list-metric-config/list-metric-config.component').then(
        (m) => m.ListMetricConfigComponent,
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'users',
    loadComponent: () =>
      import('./components/users/list-users/list-users.component').then(
        (m) => m.UsersComponent,
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'chatbot-models',
    loadComponent: () =>
      import('./components/dashboard/chatbot/list-chatbot-model/list-chatbot-model.component').then(
        (m) => m.ListChatbotModelComponent,
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'chatbot-config',
    loadComponent: () =>
      import('./components/dashboard/chatbot/list-chatbot-config/list-chatbot-config.component').then(
        (m) => m.ListChatbotConfigComponent,
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'header',
    loadComponent: () =>
      import('./components/dashboard/header/list-header/list-header.component').then(
        (m) => m.ListHeaderComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'carousel',
    loadComponent: () =>
      import('./components/dashboard/carousel/list-carousel/list-carousel.component').then(
        (m) => m.ListCarouselComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'news',
    loadComponent: () =>
      import('./components/dashboard/news/list-news/list-news.component').then(
        (m) => m.ListNewsComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'company',
    loadComponent: () =>
      import('./components/dashboard/company/list-company/list-company.component').then(
        (m) => m.ListCompanyComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'managers',
    loadComponent: () =>
      import('./components/dashboard/manager/list-manager/list-manager.component').then(
        (m) => m.ListManagerComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'manager-category',
    loadComponent: () =>
      import('./components/dashboard/manager/list-manager-category/list-manager-category.component').then(
        (m) => m.ListManagerCategoryComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./components/dashboard/reviews/list-review/list-review.component').then(
        (m) => m.ListReviewComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./components/dashboard/products/list-category/list-category.component').then(
        (m) => m.ListCategoryComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./components/dashboard/products/list-product/list-product.component').then(
        (m) => m.ListProductComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'publication-category',
    loadComponent: () =>
      import('./components/dashboard/publications/list-publication-category/list-publication-category.component').then(
        (m) => m.ListPublicationCategoryComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'publications',
    loadComponent: () =>
      import('./components/dashboard/publications/list-publications/list-publications.component').then(
        (m) => m.ListPublicationComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./components/dashboard/contact/list-contact/list-contact.component').then(
        (m) => m.ListContactComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: '',
    canActivate: [LoginGuard],
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () =>
          import('./components/auth/login/login.component').then(
            (m) => m.LoginComponent,
          ),
        data: { layout: false },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
