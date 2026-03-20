import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

export interface UploadResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private readonly defaultOptions: ImageProcessingOptions = {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.8,
    format: 'jpeg'
  };

  private readonly API_BASE_URL = environment.apiUrl; // API Principal

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) { }

  /**
   * Método genérico para processar e fazer upload de uma imagem.
   * @param file O arquivo de imagem a ser enviado.
   * @param type O tipo de imagem (ex: 'user-avatar', 'store-logo', 'store-banner').
   * @param entityId O ID da entidade à qual a imagem pertence (usuário, loja, etc.).
   * @param options Opções de processamento da imagem.
   */
  async uploadImage(
    file: File,
    type: string,
    entityId: string,
    options?: ImageProcessingOptions,
    folder?: string
  ): Promise<UploadResult> {
    try {
      console.log(`🚀 [DEBUG-${Date.now()}] Iniciando upload do tipo "${type}":`, file.name);
      console.log(`📂 [DEBUG] Folder solicitado: "${folder}"`);

      // Validar arquivo
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const processingOptions = { ...this.defaultOptions, ...options };

      // Processar imagem
      const processedBlob = await this.processImage(file, processingOptions);

      // Fazer upload para o servidor
      const result = await this._uploadToServer(processedBlob, file.name, type, entityId, folder);

      console.log('✅ Upload concluído com sucesso:', result.fileName);
      console.log('📁 Arquivo salvo em:', result.filePath);

      // Após upload, atualizar a entidade correspondente na API, quando aplicável
      if (result.success && result.filePath) {
        // Atualiza avatar se for o tipo correspondente (suporta quem usa uploadImage diretamente)
        if (type === 'user-avatar') {
          await this.updateUserAvatar(result.filePath);
        }

        // Atualiza logo da store quando o tipo for 'store-logo'
        if (type === 'store-logo') {
          if (!entityId) {
            console.warn('⚠️ Nenhum storeId fornecido para atualização do logo. Pulei a atualização da API.');
          } else {
            const update = await this.updateStoreLogo(entityId, result.filePath);
            if (!update.success) {
              console.error('❌ Falha ao atualizar logo da loja na API:', update.error);
            } else {
              console.log('🟢 Logo da loja atualizado na API com sucesso.');
            }
          }
        }

        // Atualiza banner da store quando o tipo for 'store-banner'
        if (type === 'store-banner') {
          if (!entityId) {
            console.warn('⚠️ Nenhum storeId fornecido para atualização do banner. Pulei a atualização da API.');
          } else {
            const update = await this.updateStoreBanner(entityId, result.filePath);
            if (!update.success) {
              console.error('❌ Falha ao atualizar banner da loja na API:', update.error);
            } else {
              console.log('🟢 Banner da loja atualizado na API com sucesso.');
            }
          }
        }

        // Atualiza logo da organização quando o tipo for 'org-logo'
        if (type === 'org-logo') {
          if (!entityId) {
            console.warn('⚠️ Nenhum orgId fornecido para atualização do logo. Pulei a atualização da API.');
          } else {
            const update = await this.updateOrganizationBranding(entityId, { logo_url: result.filePath });
            if (!update.success) {
              console.error('❌ Falha ao atualizar logo da organização na API:', update.error);
            } else {
              console.log('🟢 Logo da organização atualizado na API com sucesso.');
            }
          }
        }

        // Atualiza banner da organização quando o tipo for 'org-banner'
        if (type === 'org-banner') {
          if (!entityId) {
            console.warn('⚠️ Nenhum orgId fornecido para atualização do banner. Pulei a atualização da API.');
          } else {
            const update = await this.updateOrganizationBranding(entityId, { banner_url: result.filePath });
            if (!update.success) {
              console.error('❌ Falha ao atualizar banner da organização na API:', update.error);
            } else {
              console.log('🟢 Banner da organização atualizado na API com sucesso.');
            }
          }
        }
      }

      return result;

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Processa e faz upload de uma imagem de avatar (mantido para compatibilidade).
   */
  async uploadAvatar(file: File): Promise<UploadResult> {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id_code) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    // Remover avatar antigo se existir
    if (user.avatar_url) {
      await this.removeOldAvatar(user.avatar_url);
    }

    // Chama o método genérico
    const result = await this.uploadImage(
      file,
      'user-avatar',
      user.id_code,
      this.defaultOptions,
      `users/${user.id_code}/avatar`
    );

    if (result.success && result.filePath) {
      // Atualiza o avatar do usuário na API principal
      await this.updateUserAvatar(result.filePath);
    }
    return result;
  }

  /**
   * Valida o arquivo de entrada
   */
  private validateFile(file: File): { valid: boolean; error?: string } {
    // Verificar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Formato não suportado. Use apenas JPEG ou PNG.'
      };
    }

    // Verificar tamanho (5MB máximo)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'Arquivo muito grande. Máximo 5MB.'
      };
    }

    return { valid: true };
  }

  /**
   * Processa a imagem: redimensiona e comprime
   */
  private async processImage(file: File, options: ImageProcessingOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // Calcular dimensões mantendo proporção
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth!,
            options.maxHeight!
          );

          // Configurar canvas
          canvas.width = width;
          canvas.height = height;

          // Desenhar imagem redimensionada
          ctx!.drawImage(img, 0, 0, width, height);

          // Converter para blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`📏 Imagem processada: ${width}x${height}, ${(blob.size / 1024).toFixed(1)}KB`);
                resolve(blob);
              } else {
                reject(new Error('Falha ao processar imagem'));
              }
            },
            `image/${options.format}`,
            options.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calcula dimensões mantendo proporção
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    // Redimensionar se necessário
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Envia o arquivo processado para o servidor de utilidades.
   */
  private async _uploadToServer(
    blob: Blob,
    fileName: string,
    type: string,
    entityId: string,
    folderPath?: string
  ): Promise<UploadResult> {
    try {
      // Criar FormData para enviar o arquivo
      const formData = new FormData();
      const file = new File([blob], fileName, { type: blob.type });
      formData.append('file', file); // API espera 'file'
      formData.append('type', type);
      formData.append('entityId', entityId);

      // Determinar pasta
      let folderToSend = folderPath;

      if (!folderToSend) {
        // Fallback: Lógica baseada no tipo (compatibilidade)
        const t = (type || '').toLowerCase();
        if (t.includes('event')) folderToSend = 'events';
        else if (t.startsWith('store')) folderToSend = 'stores';
        else if (t.includes('user')) folderToSend = 'users';
        console.log(`⚠️ [DEBUG] Folder não informado. Fallback automático para: "${folderToSend}"`);
      }

      if (folderToSend) formData.append('folder', folderToSend);

      console.log(`📤 [DEBUG] Enviando arquivo para API principal (tipo: ${type}):`, fileName);
      console.log(`📂 [DEBUG] Pasta FINAL enviada no FormData: "${folderToSend}"`);

      // Endpoint na API principal
      const response = await this.http.post<any>(`${this.API_BASE_URL}/api/v1/uploads`, formData).toPromise();

      if (response.success) {
        // A API agora retorna a URL pronta para uso (proxy ou direta)
        const finalUrl = response.data.url || response.data.downloadUrl || response.data.fileUrl;

        return {
          success: true,
          fileName: response.data.name || fileName,
          filePath: finalUrl
        };
      } else {
        return { success: false, error: response.message || 'Erro no upload' };
      }

    } catch (error) {
      console.error('❌ Erro ao salvar arquivo:', error);
      throw new Error(`Falha ao salvar arquivo: ${error}`);
    }
  }

  /**
   * Prepara a estrutura de pastas do evento.
   * Na nova API com Google Drive, as pastas são gerenciadas automaticamente.
   * Mantido para compatibilidade.
   */
  async prepareEventFolders(idCode: string): Promise<{ success: boolean; paths?: any; error?: string }> {
    return Promise.resolve({ success: true });
  }

  /**
   * Remove avatar antigo
   */
  private async removeOldAvatar(oldAvatarUrl: string): Promise<void> {
    try {
      if (oldAvatarUrl && oldAvatarUrl !== 'images/user/default-avatar.jpg') {
        console.log(`🗑️ Removendo avatar antigo: ${oldAvatarUrl}`);
        // Em produção, aqui seria uma chamada para remover o arquivo físico
      }
    } catch (error) {
      console.warn('Aviso: Não foi possível remover avatar antigo:', error);
    }
  }

  /**
   * Remove arquivo específico
   */
  private async removeFile(filePath: string): Promise<void> {
    try {
      console.log(`🗑️ Removendo arquivo: ${filePath}`);
      // Em produção, aqui seria uma chamada para remover o arquivo físico
    } catch (error) {
      console.warn('Aviso: Não foi possível remover arquivo:', error);
    }
  }

  /**
   * Atualiza avatar via API
   */
  private async updateUserAvatar(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const avatarUrl = filePath;

      console.log('🔄 Atualizando avatar via API:', avatarUrl);

      const result = await this.authService.updateUser({ avatar_url: avatarUrl }).toPromise();

      if (result?.success) {
        console.log('✅ API atualizada com sucesso');
        return { success: true };
      } else {
        return { success: false, error: 'Resposta inválida da API' };
      }
    } catch (error) {
      console.error('❌ Erro na API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro na API'
      };
    }
  }

  /**
   * Atualiza o logo da loja via API
   */
  private async updateStoreLogo(storeId: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.patchStoreBranding(storeId, { logo_url: filePath });
  }

  /**
   * Atualiza o banner da loja via API
   */
  private async updateStoreBanner(storeId: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.patchStoreBranding(storeId, { banner_url: filePath });
  }

  /**
   * Método interno para fazer o patch de branding da loja
   */
  private async patchStoreBranding(storeId: string, data: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 Fazendo patch na loja ${storeId}:`, data);

      const token = this.authService.getAuthToken();
      let headers = new HttpHeaders();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }

      const result = await this.http.put<any>(`${environment.apiUrl}/api/v1/stores/${storeId}`, data, { headers, responseType: 'json' }).toPromise();

      if (result?.success) {
        console.log('✅ API da loja atualizada com sucesso');
        return { success: true };
      } else {
        return { success: false, error: 'Resposta inválida da API da loja' };
      }
    } catch (error) {
      console.error('❌ Erro na API da loja:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro na API da loja' };
    }
  }

  /**
   * Processa múltiplas imagens (para uso futuro)
   */
  async processMultipleImages(
    files: FileList,
    options?: ImageProcessingOptions
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const processingOptions = { ...this.defaultOptions, ...options };

    for (let i = 0; i < files.length; i++) {
      const result = await this.uploadAvatar(files[i]);
      results.push(result);
    }

    return results;
  }

  /**
   * Obtém informações de uma imagem
   */
  async getImageInfo(file: File): Promise<{
    width: number;
    height: number;
    size: number;
    type: string;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          size: file.size,
          type: file.type
        });
      };

      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Atualiza o branding da organização via API
   */
  private async updateOrganizationBranding(orgId: string, data: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 Fazendo patch na organização ${orgId}:`, data);

      const token = this.authService.getAuthToken();
      let headers = new HttpHeaders();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }

      const result = await this.http.put<any>(`${environment.apiUrl}/api/v1/organizations/${orgId}`, data, { headers, responseType: 'json' }).toPromise();

      if (result?.success) {
        console.log('✅ API da organização atualizada com sucesso');
        return { success: true };
      } else {
        return { success: false, error: 'Resposta inválida da API da organização' };
      }
    } catch (error) {
      console.error('❌ Erro na API da organização:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro na API da organização' };
    }
  }
}