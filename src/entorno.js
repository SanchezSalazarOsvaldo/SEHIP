// Carga las variables de entorno para usar datos privados.
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
    // Las variables del sistema tienen prioridad sobre el archivo.
    if (process.env[nombre] === undefined) process.env[nombre] = valor;
  });
}
