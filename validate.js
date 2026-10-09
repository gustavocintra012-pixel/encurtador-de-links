const MAX_LENGTH = 2048;

function isPrivateHost(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.startsWith('[')) return true; // endereços IPv6
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function validateUrl(input) {
  if (typeof input !== 'string') return null;

  const text = input.trim();
  if (text.length === 0 || text.length > MAX_LENGTH) return null;

  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (isPrivateHost(url.hostname)) return null;

  return url.href;
}

module.exports = { validateUrl };
