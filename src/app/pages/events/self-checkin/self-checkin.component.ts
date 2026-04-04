import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { firstValueFrom } from 'rxjs';
import { EventTicketsService, SelfCheckinNeedTicketError } from '../event-tickets.service';

@Component({
  selector: 'app-self-checkin',
  standalone: true,
  imports: [CommonModule, RouterModule, ZXingScannerModule],
  template: `
    <div class="min-h-[calc(100vh-140px)]">
      <div class="mx-auto max-w-2xl py-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Self-checkin</h1>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Leia o QR Code do evento para entrar.
            </p>
          </div>
          <a routerLink="/" class="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">Voltar</a>
        </div>

        @if (errorMessage) {
          <div class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
            {{ errorMessage }}
          </div>
        }
        @if (successMessage) {
          <div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
            {{ successMessage }}
          </div>
        }

        <div class="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="relative w-full overflow-hidden rounded-xl bg-black">
            <div class="pointer-events-none absolute inset-0 z-10 border-4 border-brand-500/60"></div>
            <zxing-scanner
              class="block w-full"
              [formats]="allowedFormats"
              [device]="selectedDevice"
              (scanSuccess)="onScanSuccess($event)"
              (camerasFound)="onCamerasFound($event)"
              (scanError)="onScanError($event)"
            ></zxing-scanner>
            @if (isBusy) {
              <div class="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                <div class="flex flex-col items-center gap-3">
                  <div class="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
                  <div class="text-sm font-semibold text-white">Confirmando check-in...</div>
                </div>
              </div>
            }
          </div>
          <div class="mt-4 text-xs text-gray-500 dark:text-gray-500">
            Use o QR Code do evento para validar seu ingresso e entrar.
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SelfCheckinComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private ticketsService = inject(EventTicketsService);

  isBusy = false;
  errorMessage = '';
  successMessage = '';

  availableDevices: MediaDeviceInfo[] = [];
  selectedDevice: MediaDeviceInfo | undefined;
  allowedFormats = [BarcodeFormat.QR_CODE];

  ngOnInit(): void {}

  ngOnDestroy(): void {
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    const rearCamera = devices.find((d) => /back|rear|environment/i.test(d.label));
    this.selectedDevice = rearCamera || devices[0];
  }

  onScanError(_error: unknown): void {}

  async onScanSuccess(scannedData: string): Promise<void> {
    if (this.isBusy) return;
    const eventId = this.extractEventId(scannedData);
    if (!eventId) return;
    await this.handleEventId(eventId);
  }

  private extractEventId(value: string): string | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuid?.[0]) return uuid[0];

    const evt = raw.match(/evt-[0-9a-f-]{8,}/i);
    if (evt?.[0]) return evt[0];

    const urlMatch = raw.match(/\/events\/checkin\/([A-Za-z0-9-]+)/i);
    if (urlMatch?.[1]) return urlMatch[1];

    return null;
  }

  private async handleEventId(eventId: string): Promise<void> {
    this.isBusy = true;
    this.errorMessage = '';
    this.successMessage = '';
    let pendingNavigation = false;
    try {
      const resp = await firstValueFrom(this.ticketsService.selfCheckin(eventId));
      const already = !!resp?.data?.already_checked_in;
      this.successMessage = already ? 'Você já estava com check-in confirmado.' : 'Check-in confirmado.';
      pendingNavigation = true;
      setTimeout(() => {
        this.router.navigate([`/events/checkin/${eventId}`], { queryParams: { returnUrl: `/events/home-guest-v2/${eventId}` } });
      }, 1500);
      return;
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const code = String(err?.error?.code || '');
      if (status === 409 && code === 'need_ticket') {
        const payload = err?.error as SelfCheckinNeedTicketError;
        this.errorMessage = payload?.message || 'Você precisa reservar um ingresso antes do check-in.';
        pendingNavigation = true;
        setTimeout(() => {
          this.router.navigate([`/tickets/reserve/${eventId}`]);
        }, 1500);
      } else {
        this.errorMessage = err?.error?.message || err?.message || 'Falha ao confirmar check-in. Tente novamente.';
      }
    } finally {
      if (!pendingNavigation) this.isBusy = false;
    }
  }
}
