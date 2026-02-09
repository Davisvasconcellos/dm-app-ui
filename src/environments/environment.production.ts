export const environment = {
  production: true,
  // API pública em produção
  apiUrl: 'https://beerclub-api.onrender.com',
  // Utilitário (upload/imagens/PDFs) dentro da própria aplicação
  utilityUrl: 'https://app.vibesessionsproject.com',
  firebase: {
    apiKey: 'AIzaSyA7zvzWRs48FC9zytDxTzTQNagVCyQmOGI',
    authDomain: 'auth-eb4ce.firebaseapp.com',
    projectId: 'auth-eb4ce',
    storageBucket: 'auth-eb4ce.firebasestorage.app',
    messagingSenderId: '685028289415',
    appId: '1:685028289415:web:81da113e41f1d4727b0122',
    measurementId: 'G-6FGYMNZLWB'
  },
  discogs: {
    consumerKey: 'OgeHaOVwtqMMAmvqxLwM',
    consumerSecret: 'zBSksfwksFgVHEgmyTPOnqhxBkKOJkvT',
    token: 'VbXnvrbEYORoZCcdUxVBKZbnBTBhznHHOvRvCCHM'
  }
};