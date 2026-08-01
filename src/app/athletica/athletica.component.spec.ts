import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AthleticaComponent } from './athletica.component';

describe('AthleticaComponent', () => {
  let component: AthleticaComponent;
  let fixture: ComponentFixture<AthleticaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AthleticaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AthleticaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
