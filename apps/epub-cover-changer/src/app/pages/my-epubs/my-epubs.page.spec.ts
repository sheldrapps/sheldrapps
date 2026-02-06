import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyEpubsPage } from './my-epubs.page';

describe('MyEpubsPage', () => {
  let component: MyEpubsPage;
  let fixture: ComponentFixture<MyEpubsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MyEpubsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render', () => {
    expect(component).toBeTruthy();
  });
});
