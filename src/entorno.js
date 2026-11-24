// Lee las variables privadas antes de iniciar.
const fs = require('fs');
const path = require('path');



const ARCHIVO_ENV = path.join(__dirname, '..', '.env');



if (fs.existsSync(ARCHIVO_ENV)) {
  fs.readFileSync(ARCHIVO_ENV, 'utf8').split(/\r?\n/).forEach((linea) => {
    const texto = linea.trim();
    if (!texto || texto.startsWith('#') || !texto.includes('=')) return;
    
    const indice = texto.indexOf('=');
    const nombre = texto.slice(0, indice).trim();
    const valor = texto.slice(indice + 1).trim().replace(/^["']|["']$/g, '');
    // Aplica esta comprobación antes de continuar.
    if (process.env[nombre] === undefined) process.env[nombre] = valor;
  });
}
