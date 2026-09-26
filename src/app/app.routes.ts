import { Routes } from '@angular/router';
import { DrawingArtComponent } from './pages/trek-list.component/trek-list.component';
import { PrivacyPolicyComponent } from './pages/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './pages/terms-of-service/terms-of-service.component';

export const routes: Routes = [
  { path: 'drawing-art', component: DrawingArtComponent },
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'terms-of-service', component: TermsOfServiceComponent },
  { path: '', redirectTo: '/drawing-art', pathMatch: 'full' }
];

