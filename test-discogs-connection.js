const https = require('https');

// Seus dados configurados
const token = 'VbXnvrbEYORoZCcdUxVBKZbnBTBhznHHOvRvCCHM';
const query = 'thriller'; // Teste com algo famoso
const url = `https://api.discogs.com/database/search?q=${query}&type=release&per_page=3&token=${token}`;

console.log('--- INICIANDO TESTE LIMPO ---');
console.log(`URL Alvo: ${url}`);

const options = {
  headers: {
    // Discogs EXIGE User-Agent (Node.js permite enviar, o navegador bloqueia)
    'User-Agent': 'VibeSessionsTestScript/1.0' 
  }
};

https.get(url, options, (res) => {
  let data = '';

  console.log(`\nResposta recebida! Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers['content-type']);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('\n✅ SUCESSO! A API respondeu corretamente.');
        console.log(`Resultados encontrados: ${json.results?.length || 0}`);
        
        if (json.results && json.results.length > 0) {
          console.log('\n--- Primeiro Resultado ---');
          console.log(`Título: ${json.results[0].title}`);
          console.log(`Ano: ${json.results[0].year}`);
          console.log(`Capa: ${json.results[0].thumb}`);
        }
      } catch (e) {
        console.error('❌ Erro ao ler JSON:', e.message);
      }
    } else {
      console.error('\n❌ ERRO NA API:');
      console.log(data);
    }
    console.log('\n--- FIM DO TESTE ---');
  });

}).on('error', (err) => {
  console.error('\n❌ ERRO DE REDE:', err.message);
});
