import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Platform, ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';

import { TabsPage } from './tabs.page';

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [
        provideRouter([]),
        {
          provide: Platform,
          useValue: {
            is: jasmine.createSpy('is').and.returnValue(false),
            backButton: {
              subscribeWithPriority: jasmine.createSpy('subscribeWithPriority'),
            },
          },
        },
        {
          provide: ToastController,
          useValue: {
            create: jasmine.createSpy('create'),
          },
        },
        {
          provide: TranslateService,
          useValue: {
            currentLang: 'en-US',
            defaultLang: 'en-US',
            get: jasmine.createSpy('get').and.returnValue(of('Translated')),
            stream: jasmine.createSpy('stream').and.returnValue(of('Translated')),
            instant: jasmine.createSpy('instant').and.returnValue('Back again to exit'),
            onLangChange: new Subject<unknown>(),
            onTranslationChange: new Subject<unknown>(),
            onDefaultLangChange: new Subject<unknown>(),
            onFallbackLangChange: new Subject<unknown>(),
          },
        },
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
