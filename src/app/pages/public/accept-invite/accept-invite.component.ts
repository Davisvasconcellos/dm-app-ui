import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StoreInviteService } from '../../admin/stores/config/store-invite.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

@Component({
    selector: 'app-accept-invite',
    standalone: true,
    imports: [CommonModule, RouterModule, ButtonComponent],
    templateUrl: './accept-invite.component.html'
})
export class AcceptInviteComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private storeInviteService = inject(StoreInviteService);
    private toast = inject(ToastService);
    private authService = inject(AuthService);

    loading = true;
    error: string | null = null;
    inviteData: any = null;
    token: string | null = null;

    ngOnInit() {
        this.token = this.route.snapshot.queryParamMap.get('token');
        if (!this.token) {
            this.error = 'Token de convite não encontrado.';
            this.loading = false;
            return;
        }

        this.resolveInvite();
    }

    resolveInvite() {
        this.storeInviteService.resolveInvite(this.token!).subscribe({
            next: (res) => {
                this.inviteData = res.data;
                this.handleInviteResolution();
            },
            error: (err) => {
                this.error = 'Convite inválido ou expirado.';
                this.loading = false;
            }
        });
    }

    handleInviteResolution() {
        const { invite } = this.inviteData;

        if (invite.user_exists) {
            // User exists, check if logged in
            if (this.authService.isAuthenticated()) {
                this.acceptInvite();
            } else {
                // Not logged in, send to signin with token
                this.toast.triggerToast('info', 'Aviso', 'Este e-mail já possui conta. Faça login para aceitar o convite.');
                this.router.navigate(['/signin'], { queryParams: { token: this.token, email: invite.invited_email } });
            }
        } else {
            // User does not exist, send to register
            this.toast.triggerToast('info', 'Aviso', 'Você ainda não tem conta. Crie uma para aceitar o convite.');
            this.router.navigate(['/signup'], { queryParams: { token: this.token, email: invite.invited_email } });
        }
    }

    acceptInvite() {
        this.storeInviteService.acceptInvite(this.token!).subscribe({
            next: (res) => {
                this.toast.triggerToast('success', 'Sucesso', 'Convite aceito com sucesso!');
                this.authService.getUserMe().subscribe({
                    next: () => {
                        this.router.navigate(['/'], { replaceUrl: true });
                    },
                    error: () => {
                        this.router.navigate(['/'], { replaceUrl: true });
                    }
                });
            },
            error: (err) => {
                this.error = 'Não foi possível aceitar o convite.';
                this.loading = false;
            }
        });
    }
}
