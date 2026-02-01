import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequisitesPage } from './requisites.page';

describe('RequisitesPage', () => {
  let component: RequisitesPage;
  let fixture: ComponentFixture<RequisitesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RequisitesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
