const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Limita o tamanho do corpo das requisições (defesa contra envios gigantes)
app.use(express.json({ limit: '10kb' }));

app.get('/', (req, res) => {
  res.send('Encurtador de links no ar');
});

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});