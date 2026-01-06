const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3001;

// ============================================
// FRONTEND UTILITY SERVER
// ============================================
// Servidor utilitário para funcionalidades que o Angular não pode fazer sozinho
// Atualmente: Upload de imagens
// Futuro: Redimensionamento, QR Codes, PDF, etc.

console.log('🚀 Iniciando Frontend Utility Server...');

// Configurar CORS para permitir requisições do Angular
app.use(cors({
  origin: '*',
  credentials: true
}));

// Middleware para parsing JSON
app.use(express.json());

// Servir arquivos estáticos da pasta public
app.use('/images', express.static(path.join(__dirname, 'public/images'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));
// Servir PDFs gerados
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// ============================================
// CONFIGURAÇÕES GLOBAIS
// ============================================

// Diretórios base
const DIRECTORIES = {
  images: path.join(__dirname, 'public', 'images'),
  user: path.join(__dirname, 'public', 'images', 'user'),
  stores: path.join(__dirname, 'public', 'images', 'stores'),
  pdfs: path.join(__dirname, 'public', 'pdfs'),
  temp: path.join(__dirname, 'temp'),
  cache: path.join(__dirname, 'cache')
};

// Garantir que os diretórios existem
Object.values(DIRECTORIES).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('📁 Diretórios configurados:', DIRECTORIES);

// ============================================
// MÓDULO: UPLOAD DE IMAGENS
// ============================================

// Usar armazenamento em memória para ter acesso ao req.body antes de salvar
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limite
  },
  fileFilter: function (req, file, cb) {
    // Aceitar apenas imagens JPG e PNG
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JPG e PNG são permitidos!'), false);
    }
  }
});

// ============================================
// ROTAS: UPLOAD DE IMAGENS
// ============================================

function sanitizeFolderName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim().toLowerCase();
  // permitir apenas letras, números, hífen e underscore; sem espaços, sem barras
  const safe = trimmed.replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  if (!safe) return null;
  // impedir nomes reservados
  const reserved = new Set(['..', '.', 'images', 'cache', 'temp']);
  if (reserved.has(safe)) return null;
  return safe;
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Endpoint para upload de avatar
const MAX_FINAL_SIZE = 500 * 1024; // 500KB

async function processImageToLimit(buffer, options) {
  const {
    width,
    height,
    fit = 'cover',
    format, // jpeg|png|webp|avif
    quality: initialQuality = 80,
    originalExt
  } = options;

  // decidir formato alvo
  let targetFormat = (format || '').toLowerCase();
  if (!targetFormat) {
    // se png, usar webp para melhor compressão por padrão
    if (originalExt === '.png') targetFormat = 'webp';
    else if (originalExt === '.jpg' || originalExt === '.jpeg') targetFormat = 'jpeg';
    else targetFormat = 'webp';
  }

  let quality = initialQuality;
  let currentWidth = width || null;
  let currentHeight = height || null;

  for (let attempts = 0; attempts < 8; attempts++) {
    let pipeline = sharp(buffer).rotate().resize({ width: currentWidth, height: currentHeight, fit, withoutEnlargement: true });

    if (targetFormat === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (targetFormat === 'png') {
      // png é pouco eficiente para fotos; se estourar o limite, trocaremos para webp
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else if (targetFormat === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (targetFormat === 'avif') {
      pipeline = pipeline.avif({ quality });
    }

    const outBuffer = await pipeline.toBuffer();

    if (outBuffer.length <= MAX_FINAL_SIZE) {
      return { buffer: outBuffer, ext: `.${targetFormat}` };
    }

    // se PNG e muito grande, migrar para WEBP na próxima tentativa
    if (targetFormat === 'png') {
      targetFormat = 'webp';
      continue;
    }

    // reduzir qualidade até um mínimo
    if (quality > 35) {
      quality = Math.max(35, quality - 10);
      continue;
    }

    // reduzir dimensões em 10% quando qualidade já está baixa
    if (currentWidth || currentHeight) {
      if (currentWidth) currentWidth = Math.max(64, Math.floor(currentWidth * 0.9));
      if (currentHeight) currentHeight = Math.max(64, Math.floor(currentHeight * 0.9));
      continue;
    } else {
      // se nenhum tamanho foi informado, reduzir para 90% do tamanho original automaticamente
      const meta = await sharp(buffer).metadata();
      currentWidth = Math.max(64, Math.floor((meta.width || 0) * 0.9));
      currentHeight = Math.max(64, Math.floor((meta.height || 0) * 0.9));
      continue;
    }
  }

  // última tentativa: retornar mesmo assim (pode exceder)
  const finalBuffer = await sharp(buffer).rotate().toFormat('webp', { quality: 35 }).toBuffer();
  return { buffer: finalBuffer, ext: '.webp' };
}

const handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo foi enviado' 
      });
    }

    // Agora req.body está disponível e podemos determinar o destino e o nome do arquivo
    const uploadType = req.body.type || 'user'; // 'banner' | 'profile' | 'user' | 'store-*'
    const { entityId } = req.body;
    const w = req.body.w ? parseInt(req.body.w, 10) : undefined;
    const h = req.body.h ? parseInt(req.body.h, 10) : undefined;
    const fit = (req.body.fit || 'cover').toLowerCase();
    const requestedFormat = req.body.format ? String(req.body.format).toLowerCase() : undefined;
    const q = req.body.q ? parseInt(req.body.q, 10) : undefined;
    const rawFolder = req.body.folder ? String(req.body.folder) : undefined;
  const customFolder = sanitizeFolderName(rawFolder);
  const safeEntityId = sanitizeFolderName(entityId);

  // Determinar pasta base
  let baseFolder = 'user';
  if (customFolder) {
    baseFolder = customFolder; // ex.: 'events', 'stores', 'user'
  } else if (uploadType.startsWith('store-')) {
    baseFolder = 'stores';
  }

  // Se for events e houver entityId, usar subpasta events/<id>
  let folderPathForUrl = baseFolder; // para montar a URL
  let destDir = path.join(DIRECTORIES.images, baseFolder);
  ensureDirExists(destDir);

  if (baseFolder === 'events' && safeEntityId) {
    destDir = path.join(destDir, safeEntityId);
    ensureDirExists(destDir);
    folderPathForUrl = path.join(baseFolder, safeEntityId);
  }

    // Gerar nome de arquivo simples: (user|store)-timestamp.ext
    const extension = path.extname(req.file.originalname).toLowerCase();
  const baseType = baseFolder;
    
    // Processar imagem com limite de 500KB
    const { buffer: outBuffer, ext: finalExt } = await processImageToLimit(req.file.buffer, {
      width: w,
      height: h,
      fit,
      format: requestedFormat,
      quality: q || 80,
      originalExt: extension
    });

    const filename = `${baseType}-${Date.now()}${finalExt}`;
  const finalPath = path.join(destDir, filename);
  const fileUrl = `${req.protocol}://${req.get('host')}/images/${folderPathForUrl}/${filename}`;

    // Salvar o buffer processado no disco
    fs.writeFileSync(finalPath, outBuffer);
    
    console.log('✅ Upload realizado com sucesso:', {
      originalName: req.file.originalname,
      filename: filename,
      size: outBuffer.length,
      url: fileUrl,
      folder: folderPathForUrl
    });

    res.json({
      success: true,
      message: 'Upload realizado com sucesso!',
      filename: filename,
      url: fileUrl,
      size: outBuffer.length,
      folder: folderPathForUrl
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
};

// Novo endpoint genérico
app.post('/upload/image', upload.single('image'), handleUpload);

// Endpoint antigo para compatibilidade (redireciona internamente)
app.post('/upload-avatar', upload.single('avatar'), handleUpload);

// Endpoint para deletar avatar
app.delete('/delete-avatar/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(DIRECTORIES.user, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Arquivo deletado:', filename);
      
      res.json({
        success: true,
        message: 'Arquivo deletado com sucesso!',
        filename: filename
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }
  } catch (error) {
    console.error('❌ Erro ao deletar arquivo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao deletar arquivo',
      error: error.message 
    });
  }
});

// ============================================
// PREPARO DE PASTAS DE EVENTO
// ============================================
// Cria: images/events/<id_code>, e subpastas images/events/<id_code>/gallery e /guests
app.post('/events/prepare', (req, res) => {
  try {
    // Aceita tanto camelCase quanto snake_case
    const rawId = req.body?.idCode || req.body?.id_code || req.body?.entityId || '';
    const id = sanitizeFolderName(rawId);
    if (!id) {
      return res.status(400).json({ success: false, message: 'id_code inválido' });
    }

    const baseEventsDir = path.join(DIRECTORIES.images, 'events');
    ensureDirExists(baseEventsDir);

    const eventDir = path.join(baseEventsDir, id);
    ensureDirExists(eventDir);

    const galleryDir = path.join(eventDir, 'gallery');
    const guestsDir = path.join(eventDir, 'guests');
    ensureDirExists(galleryDir);
    ensureDirExists(guestsDir);

    res.json({
      success: true,
      message: 'Pastas do evento preparadas com sucesso',
      paths: {
        base: `/images/events/${id}/`,
        gallery: `/images/events/${id}/gallery/`,
        guests: `/images/events/${id}/guests/`
      }
    });
  } catch (error) {
    console.error('❌ Erro ao preparar pastas do evento:', error);
    res.status(500).json({ success: false, message: 'Erro ao preparar pastas', error: error.message });
  }
});

// ============================================
// MÓDULO: GERAÇÃO DE PDF
// ============================================

function sanitizeText(str, fallback = '') {
  if (typeof str !== 'string') return fallback;
  return str.replace(/[\u0000-\u001F\u007F]/g, '');
}

function buildSimplePdfHTML({ title, content, footer }) {
  const safeTitle = sanitizeText(title, 'Documento');
  const safeContent = sanitizeText(content, '');
  const safeFooter = sanitizeText(footer, '');
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { margin: 40px; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif; color: #111827; }
        .title { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
        .content { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
        .footer { position: fixed; bottom: 20px; left: 40px; right: 40px; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="title">${safeTitle}</div>
      <div class="content">${safeContent}</div>
      ${safeFooter ? `<div class="footer">${safeFooter}</div>` : ''}
    </body>
  </html>`;
}

async function renderHtmlToPdf(html, options = {}) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      printBackground: true,
      landscape: options.landscape || false,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// Endpoint para PDF simples
app.post('/pdf/simple', async (req, res) => {
  try {
    const {
      title = 'Documento',
      content = '',
      footer = '',
      format = 'A4',
      landscape = false,
      fileName
    } = req.body || {};

    ensureDirExists(DIRECTORIES.pdfs);

    const html = buildSimplePdfHTML({ title, content, footer });
    const buffer = await renderHtmlToPdf(html, { format, landscape });

    const baseName = sanitizeFolderName(String(fileName || title).toLowerCase()) || 'documento';
    const finalName = `${baseName}-${Date.now()}.pdf`;
    const finalPath = path.join(DIRECTORIES.pdfs, finalName);
    fs.writeFileSync(finalPath, buffer);

    const fileUrl = `${req.protocol}://${req.get('host')}/pdfs/${finalName}`;

    res.json({
      success: true,
      message: 'PDF gerado com sucesso!',
      filename: finalName,
      url: fileUrl,
      size: buffer.length
    });
  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar PDF', error: error.message });
  }
});

// ================================
// Endpoint para PDF rico
// ================================
function buildRichPdfHTML({
  origin,
  title,
  subtitle,
  content,
  footer,
  brandColor,
  bgImageUrl
}) {
  const safeTitle = sanitizeText(title, 'Relatório');
  const safeSubtitle = sanitizeText(subtitle, 'Resumo');
  const safeContent = sanitizeText(content, '');
  const safeFooter = sanitizeText(footer, 'TailAdmin');
  const color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor || '') ? brandColor : '#3b82f6';
  const logoUrl = `${origin}/images/logo/auth-logo.svg`;
  const gridUrl = `${origin}/images/shape/grid-01.svg`;
  const backgroundImage = bgImageUrl && /^https?:\/\//.test(bgImageUrl) ? bgImageUrl : `${origin}/images/grid-image/image-04.png`;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { margin: 0; }
        html, body { height: 100%; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif;
          color: #0f172a; margin: 0; background: #0b1220;
        }
        .page {
          display: flex; min-height: 100vh;
        }
        .left {
          flex: 1; padding: 32px 40px; background: #ffffff;
        }
        .right {
          flex: 1; position: relative; display: grid; place-items: center;
          background: linear-gradient( to bottom right, rgba(2,6,23,0.9), rgba(2,6,23,0.85) ), url('${backgroundImage}') center/cover no-repeat;
        }
        .brand-chip { display:inline-block; padding: 6px 10px; border-radius: 999px; background: ${color}20; color: ${color}; font-weight: 600; font-size: 12px; }
        .title { font-size: 26px; font-weight: 700; margin: 6px 0 8px; color: #0f172a; }
        .subtitle { font-size: 14px; color: #334155; }
        .divider { height: 1px; background:#e5e7eb; margin: 16px 0; }
        .content { font-size: 13px; line-height: 1.7; color:#0f172a; white-space: pre-wrap; }

        .hero {
          text-align:center; color:#e2e8f0;
        }
        .hero .logo { display:block; margin: 0 auto 12px; }
        .hero .strap { font-size: 13px; color: #cbd5e1; }
        .shape-top,
        .shape-bottom {
          position:absolute; width: 340px; opacity: 0.25; z-index: 0;
        }
        .shape-top { right: 24px; top: 24px; }
        .shape-bottom { left: 24px; bottom: 24px; transform: rotate(180deg); }

        .footer {
          position: fixed; bottom: 18px; left: 24px; right: 24px;
          font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; background: #fff;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <section class="left">
          <span class="brand-chip">PDF Rico</span>
          <h1 class="title">${safeTitle}</h1>
          <p class="subtitle">${safeSubtitle}</p>
          <div class="divider"></div>
          <div class="content">${safeContent}</div>
        </section>
        <section class="right">
          <img class="shape-top" src="${gridUrl}" alt="grid" />
          <img class="shape-bottom" src="${gridUrl}" alt="grid" />
          <div class="hero" style="z-index:1;">
            <img class="logo" src="${logoUrl}" alt="Logo" width="231" height="48" />
            <p class="strap">Vibe Sessions Project</p>
          </div>
        </section>
      </div>
      ${safeFooter ? `<div class="footer">${safeFooter}</div>` : ''}
    </body>
  </html>`;
}

app.post('/pdf/rich', async (req, res) => {
  try {
    const {
      title = 'Relatório de Exemplo',
      subtitle = 'Documento com layout rico',
      content = 'Este PDF inclui imagem de fundo, formas e cores de marca.',
      footer = 'Gerado por TailAdmin Utility Server',
      brandColor = '#3b82f6',
      bgImageUrl,
      format = 'A4',
      landscape = false,
      fileName
    } = req.body || {};

    ensureDirExists(DIRECTORIES.pdfs);
    const origin = `${req.protocol}://${req.get('host')}`;
    const html = buildRichPdfHTML({ origin, title, subtitle, content, footer, brandColor, bgImageUrl });
    const buffer = await renderHtmlToPdf(html, { format, landscape });

    const baseName = sanitizeFolderName(String(fileName || 'pdf-rich').toLowerCase()) || 'pdf-rich';
    const finalName = `${baseName}-${Date.now()}.pdf`;
    const finalPath = path.join(DIRECTORIES.pdfs, finalName);
    fs.writeFileSync(finalPath, buffer);

    const fileUrl = `${origin}/pdfs/${finalName}`;

    res.json({
      success: true,
      message: 'PDF rico gerado com sucesso!',
      filename: finalName,
      url: fileUrl,
      size: buffer.length
    });
  } catch (error) {
    console.error('❌ Erro ao gerar PDF rico:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar PDF rico', error: error.message });
  }
});

// ============================================
// ROTAS: INFORMAÇÕES DO SERVIDOR
// ============================================

// (endpoint /status removido do escopo atual)

// Endpoint para listar arquivos de usuário
app.get('/files/user', (req, res) => {
  try {
    const files = fs.readdirSync(DIRECTORIES.user)
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
      .map(file => {
        const filePath = path.join(DIRECTORIES.user, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: `/images/user/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      });

    res.json({
      success: true,
      count: files.length,
      files: files
    });
  } catch (error) {
    console.error('❌ Erro ao listar arquivos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar arquivos',
      error: error.message
    });
  }
});

// ============================================
// MIDDLEWARE DE ERRO E INICIALIZAÇÃO
// ============================================

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('❌ Erro no servidor:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Máximo 5MB permitido.'
      });
    }
  }

  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: error.message
  });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('🎯 ============================================');
  console.log('🚀 FRONTEND UTILITY SERVER INICIADO');
  console.log('🎯 ============================================');
  console.log(`📡 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📁 Diretório de imagens: ${DIRECTORIES.user}`);
  console.log('');
  console.log('📋 Funcionalidades ativas:');
  console.log('   ✅ Upload de imagens (/upload-avatar)');
  console.log('   ✅ Upload genérico de imagens (/upload/image)');
  console.log('   ✅ Listagem de arquivos (/files/user)');
  console.log('   ✅ Geração de PDF simples (/pdf/simple)');
  console.log('');
  console.log('🔮 Funcionalidades futuras:');
  console.log('   ⏳ Redimensionamento de imagens');
  console.log('   ⏳ Geração de QR Codes');
  console.log('   ⏳ Geração de PDF rico');
  console.log('   ⏳ Proxy reverso');
  console.log('🎯 ============================================');
  console.log('');
});