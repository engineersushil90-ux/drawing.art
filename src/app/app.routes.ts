import { Routes } from '@angular/router';
import { TrekListComponent } from './pages/trek-list.component/trek-list.component';

export const routes: Routes = [
  { path: 'treks', component: TrekListComponent },
  { path: '', redirectTo: '/treks', pathMatch: 'full' }
];
