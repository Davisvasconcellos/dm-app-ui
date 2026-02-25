const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const dir = './src/environments';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const envConfigFile = `export const environment = {
  production: false,
  apiUrl: '${process.env.API_URL}',
  utilityUrl: '${process.env.UTILITY_URL}',
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${process.env.FIREBASE_PROJECT_ID}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${process.env.FIREBASE_APP_ID}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID}'
  },
  discogs: {
    token: '${process.env.DISCOGS_TOKEN}'
  }
};
`;

const envProdConfigFile = `export const environment = {
  production: true,
  // API pública em produção
  apiUrl: '${process.env.API_URL_PROD || process.env.API_URL}',
  //utilityUrl: '${process.env.UTILITY_URL_PROD || process.env.UTILITY_URL}',
  utilityUrl: 'undefined',
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${process.env.FIREBASE_PROJECT_ID}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${process.env.FIREBASE_APP_ID}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID}'
  },
  discogs: {
    consumerKey: '${process.env.DISCOGS_CONSUMER_KEY}',
    consumerSecret: '${process.env.DISCOGS_CONSUMER_SECRET}',
    token: '${process.env.DISCOGS_TOKEN}'
  }
};
`;

const targetPath = './src/environments/environment.ts';
const targetPathProd = './src/environments/environment.production.ts';

fs.writeFile(targetPath, envConfigFile, function (err) {
  if (err) {
    console.log(err);
  }
  console.log(`Output generated at ${targetPath}`);
});

fs.writeFile(targetPathProd, envProdConfigFile, function (err) {
  if (err) {
    console.log(err);
  }
  console.log(`Output generated at ${targetPathProd}`);
});
