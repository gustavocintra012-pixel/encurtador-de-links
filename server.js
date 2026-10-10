const crypto = require('crypto');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { generateCode } = require('./code');
const { validateUrl } = require('./validate');

const app = express();
const PORT = process.env.PORT || 3000;

// Cabeçalhos de segurança (e remove o "X-Powered-By: Express")
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
  })
);

// Limita o tamanho do corpo das requisições (defesa contra envios gigantes)
app.use(express.json({ limit: '10kb' }));

// Entrega a página (pasta "public") na rota inicial
app.use(express.static(path.join(__dirname, 'public')));

// Limite geral para a API: 100 requisições por 15 minutos por visitante
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

// Limite mais rígido para criar links: 20 por 15 minutos por visitante
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Você criou links demais. Tente novamente em alguns minutos.' },
});

app.use('/api', apiLimiter);

const insertLink = db.prepare(
  'INSERT INTO links (code, url, token_hash) VALUES (?, ?, ?)'
);
const findLink = db.prepare('SELECT url FROM links WHERE code = ?');
const addClick = db.prepare('UPDATE links SET clicks = clicks + 1 WHERE code = ?');
const findStats = db.prepare(
  'SELECT url, clicks, created_at, token_hash FROM links WHERE code = ?'
);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

app.post('/api/links', createLimiter, (req, res) => {
  const url = validateUrl(req.body && req.body.url);
  if (!url) {
    return res.status(400).json({
      error: 'URL inválida. Use um endereço completo, começando com http:// ou https://',
    });
  }

  const token = crypto.randomBytes(16).toString('hex');
  const tokenHash = hashToken(token);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      insertLink.run(code, url, tokenHash);
      return res.status(201).json({
        code,
        shortUrl: `${req.protocol}://${req.get('host')}/${code}`,
        token,
      });
    } catch (err) {
      // Se o código já existir, o banco recusa e tentamos outro
      if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err;
    }
  }

  res.status(500).json({ error: 'Não foi possível gerar um código. Tente novamente.' });
});

app.get('/api/links/:code/stats', (req, res) => {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({
      error: 'Token ausente. Envie no cabeçalho Authorization: Bearer <token>',
    });
  }

  const { code } = req.params;
  const link = /^[A-Za-z0-9]{6}$/.test(code) ? findStats.get(code) : undefined;

  // Compara os hashes em tempo constante e responde igual para "não existe" e "token errado"
  const received = Buffer.from(hashToken(token), 'hex');
  if (!link || !crypto.timingSafeEqual(received, Buffer.from(link.token_hash, 'hex'))) {
    return res.status(404).json({ error: 'Link não encontrado' });
  }

  res.json({
    code,
    url: link.url,
    clicks: link.clicks,
    createdAt: link.created_at,
  });
});

app.get('/:code', (req, res) => {
  const { code } = req.params;

  // Só consulta o banco se o código tiver o formato que geramos
  if (!/^[A-Za-z0-9]{6}$/.test(code)) {
    return res.status(404).send('Link não encontrado');
  }

  const link = findLink.get(code);
  if (!link) {
    return res.status(404).send('Link não encontrado');
  }

  addClick.run(code);
  res.redirect(302, link.url);
});

// Último "pega-tudo": responde erros sem mostrar detalhes internos
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisição grande demais' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});