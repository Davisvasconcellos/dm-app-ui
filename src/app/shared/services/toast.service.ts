import { Injectable, ApplicationRef, Injector, EnvironmentInjector, createComponent } from '@angular/core';
import { NotificationComponent } from '../components/ui/notification/notification/notification.component';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private envInjector: EnvironmentInjector
  ) {}

  triggerToast(
    variant: 'success' | 'info' | 'warning' | 'error',
    title: string,
    description?: string,
    hideDuration = 3000
  ) {
    const compRef = createComponent(NotificationComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    
    compRef.setInput('variant', variant);
    compRef.setInput('title', title);
    compRef.setInput('description', description);
    compRef.setInput('hideDuration', hideDuration);
    
    this.appRef.attachView(compRef.hostView);
    const host = compRef.location.nativeElement as HTMLElement;
    
    host.style.position = 'fixed';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';
    
    document.body.appendChild(host);
    
    setTimeout(() => {
      this.appRef.detachView(compRef.hostView);
      compRef.destroy();
    }, hideDuration + 200);
  }
}
