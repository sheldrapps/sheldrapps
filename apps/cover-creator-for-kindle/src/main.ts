import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

async function bootstrap() {
  const { createBootstrapProviders } = await import(
    './app/bootstrap.providers'
  );

  await bootstrapApplication(AppComponent, {
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      ...createBootstrapProviders(),
    ],
  });
}

void bootstrap();
