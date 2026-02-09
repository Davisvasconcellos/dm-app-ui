import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DiscogsResult {
  id: number;
  title: string;          // geralmente vem como "Artist - Title"
  thumb: string;
  cover_image: string;
  year?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiscogsService {
  // Em produção usamos a URL direta. Em desenvolvimento, usamos o proxy '/discogs-api' configurado no proxy.conf.json
  // para evitar problemas de CORS no localhost.
  private readonly API_URL = environment.production 
    ? 'https://api.discogs.com/database/search' 
    : '/discogs-api/database/search';

  // Valores vindos do environment
  private readonly CONSUMER_KEY = environment.discogs?.consumerKey || '';
  private readonly CONSUMER_SECRET = environment.discogs?.consumerSecret || '';
  private readonly TOKEN = environment.discogs?.token || '';

  constructor(private http: HttpClient) {}

  /**
   * Busca releases no Discogs usando o Personal Access Token
   * @param query Termo de busca (nome da música, artista, álbum, etc.)
   * @returns Lista de resultados mapeados
   */
  search(query: string): Observable<DiscogsResult[]> {
    // Validação mínima da query
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    // Se não tiver token configurado, retorna mock
    if (!this.TOKEN) {
      console.warn('Discogs Token não encontrado no environment. Usando dados mock.');
      return this.getMockData(query);
    }

    // Parâmetros da requisição
    const params = new HttpParams()
      .set('q', query)
      .set('type', 'release')
      .set('per_page', '10')
      .set('token', this.TOKEN);

    // Headers obrigatórios
    // Browsers block manual User-Agent setting ("Refused to set unsafe header").
    // We rely on the browser's default User-Agent.
    // const headers = {
    //   'User-Agent': 'DiscogsAppDavis/1.0 (davisvasconcell@gmail.com)'
    // };

    return this.http.get<any>(this.API_URL, { params }).pipe(
      map(response => {
        // Extrai o array de resultados (ou array vazio se não existir)
        const results = response.results || [];

        // Mapeia para o formato que a aplicação espera
        return results.map((item: any) => ({
          id: item.id || 0,
          title: item.title || 'Título não encontrado',
          thumb: item.thumb || '',
          cover_image: item.cover_image || item.cover || item.images?.[0]?.uri || '',
          year: item.year ? String(item.year) : undefined
        }));
      }),
      catchError(err => {
        console.error('Erro na API do Discogs:', {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          errorBody: err.error
        });
        // Em caso de erro, retorna dados mock para não quebrar a interface
        return this.getMockData(query);
      })
    );
  }

  /**
   * Método de teste simples - apenas para verificar conexão com a API
   */
  testDiscogs(): void {
    const token = this.TOKEN;

    if (!token) {
      console.log('Token não encontrado no environment');
      return;
    }

    const url = `https://api.discogs.com/database/search?q=teste&token=${token}`;
    const headers = {
      'User-Agent': 'TesteSimples/1.0 (davisvasconcell@gmail.com)'
    };

    this.http.get(url, { headers }).subscribe({
      next: (response) => {
        console.log('✅ RESPOSTA DO DISCOGS (teste):');
        console.log(response);
      },
      error: (err) => {
        console.log('❌ ERRO NA REQUISIÇÃO (teste):');
        console.log('Status:', err.status);
        console.log('StatusText:', err.statusText);
        console.log('Mensagem:', err.message);
        if (err.error) console.log('Corpo do erro:', err.error);
      }
    });
  }

  /**
   * Retorna dados mock para desenvolvimento ou quando a API falha
   */
  private getMockData(query: string): Observable<DiscogsResult[]> {
    return of([
      {
        id: 1,
        title: `${query} (Mock) - Artista Exemplo`,
        thumb: 'https://via.placeholder.com/150',
        cover_image: 'https://via.placeholder.com/600',
        year: '2024'
      },
      {
        id: 2,
        title: `Outro ${query} - Banda Fictícia`,
        thumb: 'https://via.placeholder.com/150',
        cover_image: 'https://via.placeholder.com/600',
        year: '2023'
      }
    ]);
  }
}