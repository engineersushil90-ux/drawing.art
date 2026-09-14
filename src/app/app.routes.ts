import { Routes } from '@angular/router';
import { DrawingArtComponent } from './pages/trek-list.component/trek-list.component';

export const routes: Routes = [
  { path: 'drawing-art', component: DrawingArtComponent },
  { path: '', redirectTo: '/drawing-art', pathMatch: 'full' }
];
