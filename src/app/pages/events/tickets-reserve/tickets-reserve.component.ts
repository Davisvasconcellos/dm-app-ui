import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { EventService, ApiEvent } from '../event.service';
import { EventTicketsService } from '../event-tickets.service';

@Component({
  selector: 'app-tickets-reserve',
  standalone: true,
  imports: [CommonModule, RouterModule, QRCodeComponent],
  template: `
    <div class="mx-auto max-w-2xl py-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Reservar ingresso</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Confirme sua reserva para gerar o QR code de entrada.
          </p>
        </div>
        <a routerLink="/" class="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">Voltar</a>
      </div>

      @if (loading) {
        <div class="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="h-5 w-44 rounded bg-gray-100 dark:bg-white/5"></div>
          <div class="mt-3 h-4 w-64 rounded bg-gray-100 dark:bg-white/5"></div>
          <div class="mt-6 h-40 w-full rounded-2xl bg-gray-100 dark:bg-white/5"></div>
        </div>
      } @else if (errorMessage) {
        <div class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          {{ errorMessage }}
        </div>
      } @else {
        <div class="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="p-6">
            <div class="flex items-start gap-4">
              <div class="h-16 w-16 overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                @if (event?.banner_url) {
                  <img [src]="event?.banner_url" class="h-full w-full object-cover" alt="">
                }
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
                  {{ event?.title || event?.name || 'Evento' }}
                </div>
                <div class="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {{ event?.place || '' }}
                </div>
                <div class="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  {{ dateLabel }}
                </div>
              </div>
            </div>

            <div class="mt-5 flex flex-col gap-3">
              <button
                type="button"
                (click)="reserve()"
                [disabled]="reserving || !!reservedTicketId"
                class="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                @if (reservedTicketId) {
                  Ingresso reservado
                } @else if (reserving) {
                  Reservando...
                } @else {
                  Reservar ingresso
                }
              </button>

              @if (reservedTicketId) {
                <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                  <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">QR code</div>
                  <div class="mt-3 flex items-center justify-center">
                    <div class="rounded-xl bg-white p-2">
                      <qrcode
                        [qrdata]="reservedQrData || reservedTicketId"
                        [width]="220"
                        [errorCorrectionLevel]="'M'"
                        [colorDark]="'#000000'"
                        [colorLight]="'#ffffff'"
                        class="h-full w-full"
                      />
                    </div>
                  </div>
                  <div class="mt-3 text-center text-xs text-gray-600 dark:text-gray-400 break-all">
                    {{ reservedTicketId }}
                  </div>
                  @if (expiresAtLabel) {
                    <div class="mt-2 text-center text-xs text-gray-500 dark:text-gray-500">
                      Expira em: {{ expiresAtLabel }}
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TicketsReserveComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private ticketsService = inject(EventTicketsService);

  loading = true;
  reserving = false;
  errorMessage = '';

  eventIdCode = '';
  event: ApiEvent | null = null;
  dateLabel = '';

  reservedTicketId: string | null = null;
  reservedQrData: string | null = null;
  expiresAtLabel: string | null = null;

  ngOnInit(): void {
    this.eventIdCode = String(this.route.snapshot.paramMap.get('id_code') || '');
    if (!this.eventIdCode) {
      this.errorMessage = 'Evento inválido.';
      this.loading = false;
      return;
    }

    this.eventService.getPublicEventByIdCodeDetail(this.eventIdCode).subscribe({
      next: (resp) => {
        this.event = (resp?.event || null) as ApiEvent | null;
        this.dateLabel = this.formatDateRange(this.event);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o evento.';
        this.loading = false;
      }
    });
  }

  reserve(): void {
    if (!this.eventIdCode) return;
    if (this.reserving) return;
    if (this.reservedTicketId) return;

    this.reserving = true;
    this.errorMessage = '';
    this.ticketsService.reserveTicket(this.eventIdCode).subscribe({
      next: (resp) => {
        const id = resp?.data?.ticket_id || '';
        this.reservedTicketId = id ? String(id) : null;
        const qr = resp?.data?.qr_token || id;
        this.reservedQrData = qr ? String(qr) : null;
        this.expiresAtLabel = this.formatDateTime(resp?.data?.expires_at || '');
        this.reserving = false;
      },
      error: (err) => {
        const msg = err?.error?.message || 'Não foi possível reservar o ingresso.';
        const code = err?.status ? ` (${err.status})` : '';
        this.errorMessage = `${msg}${code}`;
        this.reserving = false;
      }
    });
  }

  private formatDateRange(e: ApiEvent | null): string {
    const start = e?.start_datetime || e?.start_date || e?.startDate || '';
    const end = e?.end_datetime || e?.end_date || e?.endDate || '';
    const s = this.formatDateTime(start);
    const t = this.formatDateTime(end);
    if (s && t) return `${s} - ${t}`;
    return s || t || '';
  }

  private formatDateTime(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
