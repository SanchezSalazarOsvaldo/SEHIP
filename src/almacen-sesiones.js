// Guarda las sesiones en la base de datos.
const session = require('express-session');
const db = require('./db');


const DURACION_POR_DEFECTO_MS = 8 * 60 * 60 * 1000;

const LIMPIEZA_CADA_MS = 60 * 60 * 1000;


// Calcula cuándo vence una sesion.
function vencimiento(datos) {
  const expira = datos && datos.cookie && datos.cookie.expires;
  return new Date(expira || Date.now() + DURACION_POR_DEFECTO_MS).toISOString();
}



// Agrupa el almacen de sesiones.
class AlmacenSesiones extends session.Store {
  constructor() {
    super();
    
    setInterval(() => {
      db.query('DELETE FROM sesion WHERE expira < NOW()').catch((error) => console.error(error.message));
    }, LIMPIEZA_CADA_MS).unref();
  }

  
  get(sid, callback) {
    db.query('SELECT datos FROM sesion WHERE sid = $1 AND expira > NOW()', [sid])
      .then(({ rows }) => callback(null, rows[0] ? rows[0].datos : null))
      .catch(callback);
  }

  
  set(sid, datos, callback = () => {}) {
    db.query(
      `INSERT INTO sesion (sid, datos, expira) VALUES ($1, $2, $3)
       ON CONFLICT (sid) DO UPDATE SET datos = EXCLUDED.datos, expira = EXCLUDED.expira`,
      [sid, JSON.stringify(datos), vencimiento(datos)]
    ).then(() => callback(null)).catch(callback);
  }

  
  touch(sid, datos, callback = () => {}) {
    db.query('UPDATE sesion SET expira = $2 WHERE sid = $1', [sid, vencimiento(datos)])
      .then(() => callback(null)).catch(callback);
  }

  
  destroy(sid, callback = () => {}) {
    db.query('DELETE FROM sesion WHERE sid = $1', [sid])
      .then(() => callback(null)).catch(callback);
  }
}


module.exports = AlmacenSesiones;
