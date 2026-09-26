import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <h1>About drawing.art</h1>
      <p>Welcome to drawing.art, a dedicated space for traditional and digital art enthusiasts. Our mission is to share the beauty of hand-drawn sketches and illustrations with the world.</p>
      
      <section>
        <h2>Our Vision</h2>
        <p>We believe that every line tells a story. From the simplest pencil sketch to complex color studies, we aim to inspire budding artists and provide a gallery of high-quality artwork.</p>
      </section>

      <section>
        <h2>The Process</h2>
        <p>Most of our work is drawn from observation, focusing on lines, light, and the play of shadows. We use various mediums including graphite, charcoal, and digital tools to create our pieces.</p>
      </section>

      <a routerLink="/" class="back-link">← Back to Gallery</a>
    </div>
  `,
  styles: [`
    .page-container { max-width: 800px; margin: 60px auto; padding: 0 20px; line-height: 1.8; color: #26342d; }
    h1 { font-family: Georgia, serif; font-size: 3rem; margin-bottom: 20px; }
    h2 { font-family: Georgia, serif; margin-top: 40px; color: #f08c76; }
    .back-link { display: inline-block; margin-top: 40px; color: #f08c76; text-decoration: none; font-weight: bold; }
  `]
})
export class AboutComponent {}
