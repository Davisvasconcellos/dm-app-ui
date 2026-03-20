import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';
  private readonly CURRENT_USER_KEY = 'current_user';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';

  constructor() { }

  // Token de autenticação
  setAuthToken(token: string): void {
    try {
      localStorage.setItem(this.AUTH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Erro ao salvar token de autenticação:', error);
    }
  }

  getAuthToken(): string | null {
    try {
      return localStorage.getItem(this.AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Erro ao recuperar token de autenticação:', error);
      return null;
    }
  }

  // Refresh token
  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Erro ao salvar refresh token:', error);
    }
  }

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Erro ao recuperar refresh token:', error);
      return null;
    }
  }

  // Usuário atual
  setCurrentUser<T>(user: T): void {
    try {
      localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Erro ao salvar usuário atual:', error);
    }
  }

  getCurrentUser<T>(): T | null {
    try {
      const userData = localStorage.getItem(this.CURRENT_USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Erro ao recuperar usuário atual:', error);
      return null;
    }
  }

  /**
   * Salva dados genéricos no localStorage.
   * @param key A chave para salvar os dados.
   * @param data Os dados a serem salvos (serão convertidos para JSON).
   */
  saveData(key: string, data: any): void {
    try {
      const dataToSave = typeof data === 'string' ? data : JSON.stringify(data);
      localStorage.setItem(key, dataToSave);
    } catch (error) {
      console.error(`Erro ao salvar dados para a chave '${key}':`, error);
    }
  }

  /**
   * Recupera dados genéricos do localStorage.
   * @param key A chave dos dados a serem recuperados.
   * @returns Os dados recuperados ou null se não existirem.
   */
  getData<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      console.error(`Erro ao recuperar dados para a chave '${key}':`, error);
      return null;
    }
  }

  /**
   * Remove dados genéricos do localStorage.
   * @param key A chave dos dados a serem removidos.
   */
  removeData(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Erro ao remover dados para a chave '${key}':`, error);
    }
  }

  // Limpar todos os dados de autenticação
  clearAuthData(): void {
    try {
      localStorage.removeItem(this.AUTH_TOKEN_KEY);
      localStorage.removeItem(this.CURRENT_USER_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Erro ao limpar dados de autenticação:', error);
    }
  }

  // Verificar se há dados de autenticação
  hasAuthData(): boolean {
    return !!(this.getAuthToken() && this.getCurrentUser());
  }
}