import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoversPage } from './covers.page';

describe('CoversPage', () => {
  let component: CoversPage;
  let fixture: ComponentFixture<CoversPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CoversPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
