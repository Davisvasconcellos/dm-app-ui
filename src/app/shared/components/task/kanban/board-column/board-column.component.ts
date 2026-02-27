import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Task } from '../types/types';
import { CommonModule } from '@angular/common';
import { KanbanTaskItemComponent } from '../kanban-task-item/kanban-task-item.component';
import { DndModule, DndDropEvent } from 'ngx-drag-drop';

@Component({
  selector: 'app-board-column',
  imports: [
    CommonModule,
    KanbanTaskItemComponent,
    DndModule,
  ],
  templateUrl: './board-column.component.html',
  styles: `
    .dndDragover .dndPlaceholder {
      background-color: rgba(59, 130, 246, 0.1);
      border-color: #3b82f6;
      border-style: solid;
      transform: scale(1.02);
      transition: all 0.2s ease;
    }
    .dark .dndDragover .dndPlaceholder {
      background-color: rgba(59, 130, 246, 0.2);
    }
  `
})
export class BoardColumnComponent {

  @Input() title: string = '';
  @Input() tasks: Task[] = [];
  @Input() status: string = '';
  @Input() eventIdCode: string = '';
  @Input() jamId?: number | null;
  @Output() taskDropped = new EventEmitter<{ event: DndDropEvent, status: string }>();
  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() readyToggled = new EventEmitter<Task>();
  @Output() expandedToggled = new EventEmitter<Task>();

  onEditTask(task: Task) { this.editTask.emit(task); }
  onDeleteTask(task: Task) { this.deleteTask.emit(task); }
  onReadyToggled(task: Task) { this.readyToggled.emit(task); }
  onExpandedToggled(task: Task) { this.expandedToggled.emit(task); }

  getStatusStyles(): string {
    switch (this.status) {
      case 'todo':
        return 'bg-gray-100 text-gray-700 dark:bg-white/[0.03] dark:text-white/80';
      case 'inProgress':
        return 'text-warning-700 bg-warning-50 dark:bg-warning-500/15 dark:text-orange-400';
      case 'completed':
        return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500';
      default:
        return '';
    }
  }


  onDrop(event: DndDropEvent) {
    this.taskDropped.emit({ event, status: this.status });
  }

}
