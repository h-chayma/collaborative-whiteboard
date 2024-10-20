import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-whiteboard',
  templateUrl: './whiteboard.component.html',
  styleUrl: './whiteboard.component.css'
})
export class WhiteboardComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>; 
  private ctx!: CanvasRenderingContext2D; 
  private drawing = false;

  ngAfterViewInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.canvas.nativeElement.width = this.canvas.nativeElement.clientWidth;
    this.canvas.nativeElement.height = this.canvas.nativeElement.clientHeight;

    this.canvas.nativeElement.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.nativeElement.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.canvas.nativeElement.addEventListener('mousemove', this.draw.bind(this));
  }

  startDrawing(event: MouseEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(event.offsetX, event.offsetY);
  }

  stopDrawing() {
    this.drawing = false;
    this.ctx.closePath();
  }

  draw(event: MouseEvent) {
    if (!this.drawing) return;
    this.ctx.lineTo(event.offsetX, event.offsetY);
    this.ctx.stroke();
  }
}