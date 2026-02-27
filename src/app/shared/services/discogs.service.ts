import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DiscogsResult {
  id: number;
  discogs_id?: number;
  title: string;
  artist: string;
  cover_image: string;
  thumb_image: string;
  thumb?: string; // Compatibilidade com código legado
  year?: string;
  genre?: string;
  usage_count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DiscogsService {
  // Now using internal API for both environments to ensure consistency and catalog feeding
  private readonly API_URL = `${environment.apiUrl}/api/v1/music-catalog/search`;

  constructor(private http: HttpClient) {}

  /**
   * Busca músicas no nosso catálogo interno (que alimenta-se do Discogs se necessário)
   * @param query Termo de busca (nome da música, artista, álbum, etc.)
   * @returns Lista de músicas do catálogo
   */
  search(query: string): Observable<DiscogsResult[]> {
    if (!query || query.trim().length < 3) {
      return of([]);
    }

    const params = new HttpParams().set('q', query);

    return this.http.get<DiscogsResult[]>(this.API_URL, { params }).pipe(
      catchError(err => {
        console.error('Erro na API de Catálogo:', err);
        return this.getMockData(query);
      })
    );
  }

  /**
   * Retorna dados mock para desenvolvimento ou quando a API falha
   */
  private getMockData(query: string): Observable<DiscogsResult[]> {
    return of([
      {
        id: 1,
        title: `${query} (Mock)`,
        artist: 'Artista Exemplo',
        thumb_image: 'https://via.placeholder.com/150',
        cover_image: 'https://via.placeholder.com/600',
        year: '2024'
      },
      {
        id: 2,
        title: `Outro ${query}`,
        artist: 'Banda Fictícia',
        thumb_image: 'https://via.placeholder.com/150',
        cover_image: 'https://via.placeholder.com/600',
        year: '2023'
      }
    ]);
  }
}
