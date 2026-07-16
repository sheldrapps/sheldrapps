import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

async function bootstrap(): Promise<void> {
  const { createBootstrapProviders } = await import('./app/bootstrap.providers');

  await bootstrapApplication(AppComponent, {
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      ...await createBootstrapProviders(),
    ],
  });
}

void bootstrap();
