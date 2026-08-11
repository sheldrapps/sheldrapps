import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { InstructionsPage } from './instructions.page';

describe('InstructionsPage', () => {
  let component: InstructionsPage;
  let fixture: ComponentFixture<InstructionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstructionsPage, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(InstructionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
