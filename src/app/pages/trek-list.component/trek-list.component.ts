import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrekService, Trek} from '../../core/services/trek.service'

@Component({
  selector: 'app-trek-list',
  imports: [CommonModule],
  templateUrl: './trek-list.component.html',
  styleUrl: './trek-list.component.scss',
})
export class TrekListComponent  implements OnInit{
  public treks: Trek[] = [];
  constructor(private trekService: TrekService, private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.trekService.getTreks().subscribe({
      next: data => {
        console.log('Data received:', data);
        this.treks = data;
        this.cdr.detectChanges();
      },
      error: error => {
        console.error('Error fetching treks:', error);
      }
    });
  }
}
