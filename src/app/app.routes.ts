import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'drawing-art',
    loadComponent: () => import('./pages/trek-list.component/trek-list.component')
      .then(module => module.DrawingArtComponent)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy.component')
      .then(module => module.PrivacyPolicyComponent)
  },
  {
    path: 'terms-of-service',
    loadComponent: () => import('./pages/terms-of-service/terms-of-service.component')
      .then(module => module.TermsOfServiceComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component')
      .then(module => module.AboutComponent)
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component')
      .then(module => module.ContactComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin-viewers/admin-viewers.component')
      .then(module => module.AdminViewersComponent)
  },
  { path: '', redirectTo: '/drawing-art', pathMatch: 'full' }
];


