const $ = (selector) => document.querySelector(selector);

const form = $('#form');
const urlInput = $('#url');
const submitBtn = $('#submit');
const errorEl = $('#error');
const result = $('#result');
const shortLink = $('#short-link');
const shortUrl = $('#short-url');
const tokenEl = $('#token');
const clicksEl = $('#clicks');
const refreshBtn = $('#refresh');
const lookupForm = $('#lookup');
const lookupCode = $('#lookup-code');
const lookupToken = $('#lookup-token');
const lookupError = $('#lookup-error');
const lookupResult = $('#lookup-result');

// Guarda em memória o último link criado nesta página (some ao recarregar)
let current = null;

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function hide(el) {
  el.hidden = true;
}

// Faz a requisição e transforma qualquer falha numa mensagem legível
async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error('Não foi possível falar com o servidor.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // resposta sem JSON
  }

  if (!res.ok) {
    throw new Error((data && data.error) || 'Algo deu errado. Tente novamente.');
  }
  return data;
}

function fetchStats(code, token) {
  return request(`/api/links/${encodeURIComponent(code)}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// "2026-10-09 19:51:12" vira "09/10/2026"
function formatDate(sqlDate) {
  const [year, month, day] = sqlDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

// Criar link
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hide(errorEl);
  submitBtn.disabled = true;

  try {
    const data = await request('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value }),
    });

    current = { code: data.code, token: data.token };
    shortUrl.textContent = data.shortUrl;
    shortLink.href = data.shortUrl;
    tokenEl.textContent = data.token;
    clicksEl.textContent = '0';
    result.hidden = false;
    urlInput.value = '';
  } catch (err) {
    showError(errorEl, err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// Atualizar o contador do link recém-criado
refreshBtn.addEventListener('click', async () => {
  if (!current) return;
  refreshBtn.disabled = true;

  try {
    const data = await fetchStats(current.code, current.token);
    clicksEl.textContent = data.clicks;
    hide(errorEl);
  } catch (err) {
    showError(errorEl, err.message);
  } finally {
    refreshBtn.disabled = false;
  }
});

// Consultar qualquer link com código curto + código secreto
lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hide(lookupError);
  hide(lookupResult);

  const code = lookupCode.value.trim();
  const token = lookupToken.value.trim();

  if (!/^[A-Za-z0-9]{6}$/.test(code)) {
    return showError(lookupError, 'O código curto tem 6 letras ou números.');
  }
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return showError(lookupError, 'O código secreto tem 32 caracteres (letras de a a f e números).');
  }

  try {
    const data = await fetchStats(code, token);
    lookupResult.textContent =
      `${data.clicks} aberturas · criado em ${formatDate(data.createdAt)} · aponta para ${data.url}`;
    lookupResult.hidden = false;
  } catch (err) {
    showError(lookupError, err.message);
  }
});

// Botões de copiar
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = $(button.dataset.copy).textContent;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'copiado';
    } catch {
      button.textContent = 'não deu';
    }
    setTimeout(() => { button.textContent = original; }, 1500);
  });
});