const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { generateCode } = require('./code');
const { validateUrl } = require('./validate');

const app = express();
const PORT = process.env.PORT || 3000;

// Limita o tamanho do corpo das requisições (defesa contra envios gigantes)
app.use(express.json({ limit: '10kb' }));

const insertLink = db.prepare(
  'INSERT INTO links (code, url, token_hash) VALUES (?, ?, ?)'
);
const findLink = db.prepare('SELECT url FROM links WHERE code = ?');
const addClick = db.prepare('UPDATE links SET clicks = clicks + 1 WHERE code = ?');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

app.get('/', (req, res) => {
  res.send('Encurtador de links no ar');
});

app.post('/api/links', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});