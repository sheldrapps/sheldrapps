import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyPdfsPage } from './my-pdfs.page';

describe('MyPdfsPage', () => {
  let component: MyPdfsPage;
  let fixture: ComponentFixture<MyPdfsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MyPdfsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render', () => {
    expect(component).toBeTruthy();
  });
});
