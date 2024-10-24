import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import Konva from 'konva';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-whiteboard',
  templateUrl: './whiteboard.component.html',
  styleUrls: ['./whiteboard.component.css']
})
export class WhiteboardComponent implements AfterViewInit {
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef<HTMLDivElement>;
  private stage!: Konva.Stage;
  private layer!: Konva.Layer;
  private isDrawing = false;
  private lastLine!: Konva.Line;
  private shape: Konva.Shape | null = null;
  private strokeColor = '#000000';
  private strokeWidth = 2;
  public eraserActive = false;
  public mode = 'brush';

  private drawingSubscription!: Subscription;

  constructor(private db: AngularFireDatabase) { }

  ngAfterViewInit() {
    this.initKonva();
    this.loadExistingDrawings();
    this.syncDrawings();
  }

  initKonva() {
    const width = this.canvasContainer.nativeElement.clientWidth;
    const height = this.canvasContainer.nativeElement.clientHeight;

    this.stage = new Konva.Stage({
      container: this.canvasContainer.nativeElement,
      width: width,
      height: height,
    });

    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.stage.on('mousedown touchstart', (e) => this.startDrawing());
    this.stage.on('mouseup touchend', () => this.stopDrawing());
    this.stage.on('mousemove touchmove', (e) => this.draw(e));
  }

  startDrawing() {
    this.isDrawing = true;
    const pos = this.stage.getPointerPosition();
    if (!pos) return;
    if (this.eraserActive) return;

    if (this.mode === 'brush') {
      this.lastLine = new Konva.Line({
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth,
        globalCompositeOperation: this.mode === 'brush' ? 'source-over' : 'destination-out',
        lineCap: 'round',
        lineJoin: 'round',
        points: [pos!.x, pos!.y, pos!.x, pos!.y],
      });

      this.layer.add(this.lastLine);
    } else if (this.mode === 'rectangle' || this.mode === 'circle') {
      this.shape = this.mode === 'rectangle' ?
        new Konva.Rect({
          x: pos!.x,
          y: pos!.y,
          stroke: this.strokeColor,
          strokeWidth: this.strokeWidth,
          width: 0,
          height: 0,
        }) :
        new Konva.Circle({
          x: pos!.x,
          y: pos!.y,
          stroke: this.strokeColor,
          strokeWidth: this.strokeWidth,
          radius: 0,
        });

      this.layer.add(this.shape);
    }
  }

  stopDrawing() {
    this.isDrawing = false;

    if (this.lastLine) {
      this.saveDrawing(this.lastLine.points());
    } else if (this.shape) {
      this.saveShape();
    }
  }

  draw(event: any) {
    if (!this.isDrawing) return;
    event.evt.preventDefault();
    const pos = this.stage.getPointerPosition();

    if (this.eraserActive) {
      if (this.shape) {
        this.shape.x(pos!.x);
        this.shape.y(pos!.y);
        this.layer.batchDraw();
      }
    } else {
      if (this.mode === 'brush' && this.lastLine) {
        const newPoints = this.lastLine.points().concat([pos!.x, pos!.y]);
        this.lastLine.points(newPoints);
        this.layer.batchDraw();
        this.saveDrawing(this.lastLine.points());
      } else if ((this.mode === 'rectangle' || this.mode === 'circle') && this.shape) {
        const width = pos!.x - this.shape.x();
        const height = pos!.y - this.shape.y();

        if (this.mode === 'rectangle') {
          this.shape.width(width);
          this.shape.height(height);
        } else if (this.mode === 'circle') {
          const radius = Math.sqrt(width * width + height * height);
          (this.shape as Konva.Circle).radius(radius);
        }

        this.layer.batchDraw();
      }
    }
  }

  saveShape() {
    if (!this.shape) return;

    const shapeData = {
      type: this.mode,
      x: this.shape.x(),
      y: this.shape.y(),
      stroke: this.shape.stroke(),
      strokeWidth: this.shape.strokeWidth(),
      width: this.mode === 'rectangle' ? this.shape.width() : undefined,
      height: this.mode === 'rectangle' ? this.shape.height() : undefined,
      radius: this.mode === 'circle' ? (this.shape as Konva.Circle).radius() : undefined,
    };

    this.db.list('drawings').push(shapeData);
    this.shape = null;
  }

  saveDrawing(points: number[]) {
    const color = this.eraserActive ? 'white' : this.strokeColor;
    const size = this.eraserActive ? 10 : this.strokeWidth;

    this.db.list('drawings').push({
      points: points,
      color: color,
      size: size,
    });
  }

  loadExistingDrawings() {
    this.db.list('drawings').valueChanges().subscribe((data: any) => {
      this.layer.destroyChildren();
      data.forEach((item: any) => {
        if (item.type) {
          this.drawExistingShape(item);
        } else {
          this.drawExistingLine(item);
        }
      });
      this.layer.batchDraw();
    });
  }

  drawExistingLine(item: any) {
    const line = new Konva.Line({
      stroke: item.color,
      strokeWidth: item.size,
      globalCompositeOperation: item.color === 'white' ? 'destination-out' : 'source-over',
      lineCap: 'round',
      lineJoin: 'round',
      points: item.points,
    });

    this.layer.add(line);
  }

  drawExistingShape(item: any) {
    let shape;
    if (item.type === 'rectangle') {
      shape = new Konva.Rect({
        x: item.x,
        y: item.y,
        stroke: item.stroke,
        strokeWidth: item.strokeWidth,
        width: item.width,
        height: item.height,
      });
    } else if (item.type === 'circle') {
      shape = new Konva.Circle({
        x: item.x,
        y: item.y,
        stroke: item.stroke,
        strokeWidth: item.strokeWidth,
        radius: item.radius,
      });
    }

    if (shape) {
      this.layer.add(shape);
    }
  }

  syncDrawings() {
    this.drawingSubscription = this.db.list('drawings').stateChanges(['child_added'])
      .subscribe((change: any) => {
        const drawing = change.payload.val();
        if (drawing.type) {
          this.drawExistingShape(drawing);
        } else {
          this.drawExistingLine(drawing);
        }
        this.layer.batchDraw();
      });
  }

  changeColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.strokeColor = input.value;
  }

  changeBrushSize(size: number): void {
    this.strokeWidth = size;
  }

  toggleEraser() {
    this.eraserActive = !this.eraserActive;
    this.mode = this.eraserActive ? 'eraser' : 'brush';
  }

  clearCanvas() {
    this.layer.destroyChildren();
    this.layer.draw();
    this.db.list('drawings').remove();
  }

  ngOnDestroy() {
    if (this.drawingSubscription) {
      this.drawingSubscription.unsubscribe();
    }
  }
}
