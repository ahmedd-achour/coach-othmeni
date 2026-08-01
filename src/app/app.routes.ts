import { Routes } from '@angular/router';

import { AdminClientDetailComponent } from './admin-client-detail/admin-client-detail.component';
import { HomeComponent } from './home/home.component';
import { AdminComponent } from './admin/admin.component';
import { AthleticaComponent } from './athletica/athletica.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'athletica', component: AthleticaComponent },

];
