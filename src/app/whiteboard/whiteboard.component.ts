import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Component({
  selector: 'app-whiteboard',
  templateUrl: './whiteboard.component.html',
  styleUrls: ['./whiteboard.component.css']
})
export class WhiteboardComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private throttleTimeout: any = null;

  private strokeColor = '#000000';
  private strokeWidth = 2;
  public eraserActive = false; 

  constructor(private db: AngularFireDatabase) { }

  ngAfterViewInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.canvas.nativeElement.width = this.canvas.nativeElement.clientWidth;
    this.canvas.nativeElement.height = this.canvas.nativeElement.clientHeight;

    this.canvas.nativeElement.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.nativeElement.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.canvas.nativeElement.addEventListener('mousemove', this.throttledDraw.bind(this));

    this.db.list('drawings').valueChanges().subscribe((data: any) => {
      this.clearCanvas();
      data.forEach((item: any) => {
        this.ctx.strokeStyle = item.color;
        this.ctx.lineWidth = item.size;

        if (item.start) {
          this.ctx.beginPath();
          this.ctx.moveTo(item.x, item.y);
        } else {
          this.ctx.lineTo(item.x, item.y);
        }
        this.ctx.stroke();
      });
    });
  }

  startDrawing(event: MouseEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(event.offsetX, event.offsetY);

    const color = this.eraserActive ? 'white' : this.strokeColor; 
    const size = this.eraserActive ? 10 : this.strokeWidth; 

    this.db.list('drawings').push({
      x: event.offsetX,
      y: event.offsetY,
      color: color,
      size: size,
      start: true
    });
  }

  stopDrawing() {
    this.drawing = false;
    this.ctx.closePath();
  }

  throttledDraw(event: MouseEvent) {
    if (!this.drawing) return;

    if (!this.throttleTimeout) {
      this.throttleTimeout = setTimeout(() => {
        this.draw(event);
        this.throttleTimeout = null;
      }, 50);
    }
  }

  draw(event: MouseEvent) {
    if (!this.drawing) return;

    this.ctx.lineTo(event.offsetX, event.offsetY);
    this.ctx.stroke();

    const color = this.eraserActive ? 'white' : this.strokeColor; // Use white for eraser
    const size = this.eraserActive ? 10 : this.strokeWidth; // Use a larger size for eraser

    this.db.list('drawings').push({
      x: event.offsetX,
      y: event.offsetY,
      color: color,
      size: size,
      start: false
    });
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
  }

  changeColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.strokeColor = input.value;
  }

  changeBrushSize(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.strokeWidth = +select.value;
  }

  toggleEraser() {
    this.eraserActive = !this.eraserActive;
  }
}
