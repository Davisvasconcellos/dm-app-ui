# Integração Google Drive na API (Node.js/Express)

Como não tenho acesso direto ao repositório da API (`dm-app-api`), preparei este guia com o código exato que você precisa adicionar lá.

## 1. Configuração no Google Cloud Console
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto (ou use um existente).
3. Ative a **Google Drive API**.
4. Vá em **Credentials** > **Create Credentials** > **Service Account**.
5. Crie a conta, vá na aba **Keys** e adicione uma nova chave **JSON**.
6. Baixe o arquivo JSON e salve na raiz da sua API como `service-account.json` (não comite este arquivo!).
7. **Importante:** Compartilhe a pasta do Google Drive onde deseja salvar os arquivos com o **email da Service Account** (que está no JSON, algo como `nome-do-servico@projeto.iam.gserviceaccount.com`). Dê permissão de **Editor**.

## 2. Instalação de Dependências
Na pasta da sua API, rode:
```bash
npm install googleapis multer
```

## 3. Implementação da Rota de Upload
Crie um arquivo (ex: `routes/upload.js` ou adicione ao seu arquivo de rotas existente).

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');

// Configuração do Multer (Armazenamento em memória)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
});

// Configuração do Google Drive Auth
const KEY_FILE_PATH = path.join(__dirname, '../service-account.json'); // Ajuste o caminho
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Função auxiliar para upload de stream
 */
const uploadFileToDrive = async (fileObject, folderName) => {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileObject.buffer);

  // Mapeamento de nomes de pasta para IDs (Opcional: ou crie dinamicamente)
  // Você pode pegar o ID da pasta "uploads" na URL do Drive e fixar aqui
  const PARENT_FOLDER_ID = 'ID_DA_SUA_PASTA_NO_DRIVE_AQUI'; 

  const { data } = await drive.files.create({
    media: {
      mimeType: fileObject.mimetype,
      body: bufferStream,
    },
    requestBody: {
      name: `${Date.now()}_${fileObject.originalname}`,
      parents: [PARENT_FOLDER_ID], // Salva na pasta especificada
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  // Tornar o arquivo público (opcional, para visualização direta)
  await drive.permissions.create({
    fileId: data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return data;
};

/**
 * Rota POST /api/v1/uploads
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const folder = req.body.folder || 'uploads'; // 'events', 'users', etc.
    
    // Upload para o Drive
    const result = await uploadFileToDrive(req.file, folder);

    console.log('✅ Arquivo salvo no Drive:', result.name);

    // Retorna a URL pública
    res.json({
      success: true,
      data: {
        name: result.name,
        url: result.webViewLink, // Link para visualização
        downloadUrl: result.webContentLink, // Link para download direto
        id: result.id
      }
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({ success: false, message: 'Erro interno ao salvar arquivo.', error: error.message });
  }
});

module.exports = router;
```

## 4. Integração no `app.js` (ou `server.js`)
Não esqueça de registrar a rota na sua API principal:

```javascript
const uploadRouter = require('./routes/upload'); // Ajuste o caminho

// ...
app.use('/api/v1/uploads', uploadRouter);
```
