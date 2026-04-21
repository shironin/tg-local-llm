import { EventEmitter } from 'events';
import { AppEventMap, AppEventType } from './types';

class AppEventEmitter {
  private emitter = new EventEmitter();

  emit<T extends AppEventType>(type: T, payload: AppEventMap[T]): void {
    this.emitter.emit(type, payload);
  }

  on<T extends AppEventType>(type: T, handler: (payload: AppEventMap[T]) => void): void {
    this.emitter.on(type, handler);
  }

  off<T extends AppEventType>(type: T, handler: (payload: AppEventMap[T]) => void): void {
    this.emitter.off(type, handler);
  }
}

export const eventBus = new AppEventEmitter();
