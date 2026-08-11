import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { RequisitesPage } from './requisites.page';

describe('RequisitesPage', () => {
  let component: RequisitesPage;
  let fixture: ComponentFixture<RequisitesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequisitesPage, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(RequisitesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
