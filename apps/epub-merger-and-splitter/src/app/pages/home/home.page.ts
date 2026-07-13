import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { gitBranchOutline, gitMergeOutline } from 'ionicons/icons';
import { ActionCardComponent } from '@sheldrapps/ui-theme';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    TranslateModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    ActionCardComponent,
  ],
})
export class HomePage {
  private readonly router = inject(Router);

  constructor() {
    addIcons({
      gitBranchOutline,
      gitMergeOutline,
    });
  }

  openUnderConstruction(): void {
    void this.router.navigateByUrl('/tabs/home/under-construction');
  }
}
