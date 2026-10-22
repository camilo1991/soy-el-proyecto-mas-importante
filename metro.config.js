// Configuración de Metro: necesaria para que SQLite funcione en la versión web (WebAssembly).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// SQLite en web usa SharedArrayBuffer, que exige estas cabeceras de aislamiento.
// En producción (Vercel/Netlify) hay que configurarlas también: ver vercel.json.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
