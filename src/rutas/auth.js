// Controla el inicio de sesion de ingenieros.
const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const { MENSAJES, ROL_INGENIERO, credencialesConFormatoValido } = require('../../public/js/validaciones');
const {
  limiteInicioSesion, responderLimite, esperaPorFallos, registrarFallo, limpiarFallos
} = require('../limites');


const router = express.Router();




// Recibe el inicio de sesion.
router.post('/login', limiteInicioSesion, async (req, res) => {
  const datos = req.body || {};
  const correo = String(datos.correo ?? '').trim();
  const contrasena = String(datos.contrasena ?? '');
  
  const cuenta = correo.toLowerCase();

  const espera = esperaPorFallos(req, cuenta);
  if (espera > 0) return responderLimite(res, espera, MENSAJES.demasiadosIntentos);

  if (!credencialesConFormatoValido(correo, contrasena)) {
    registrarFallo(req, cuenta);
    return res.status(401).json({ error: MENSAJES.loginIncorrecto });
  }

  const { rows: filas } = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.contrasena_hash, u.activo, u.debe_cambiar_contrasena,
            r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
      WHERE LOWER(u.correo) = LOWER($1)`,
    [correo]
  );
  const usuario = filas[0];

  
  const accesoValido = usuario
    && usuario.activo
    && usuario.rol === ROL_INGENIERO
    && await bcrypt.compare(contrasena, usuario.contrasena_hash);

  if (!accesoValido) {
    registrarFallo(req, cuenta);
    return res.status(401).json({ error: MENSAJES.loginIncorrecto });
  }

  limpiarFallos(cuenta);
  
  req.session.usuario = datosSesion(usuario);
  res.json({ usuario: req.session.usuario });
});


// Prepara los datos que guarda la sesion.
function datosSesion(fila) {
  return {
    id: fila.id_usuario,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    debeCambiarContrasena: fila.debe_cambiar_contrasena === true
  };
}


// Cierra la sesion del usuario.
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});



// Comprueba si la cuenta sigue activa.
async function sesionVigente(req) {
  const usuario = req.session.usuario;
  if (!usuario) return null;
  const { rows: filas } = await db.query(
    'SELECT activo, debe_cambiar_contrasena FROM usuario WHERE id_usuario = $1',
    [usuario.id]
  );
  if (filas.length === 0 || !filas[0].activo) {
    req.session.destroy(() => {});
    return null;
  }
  req.session.usuario = { ...usuario, debeCambiarContrasena: filas[0].debe_cambiar_contrasena };
  return req.session.usuario;
}


// Entrega los datos de la sesion activa.
router.get('/sesion', async (req, res) => {
  const usuario = await sesionVigente(req);
  if (!usuario) return res.status(401).json({ error: 'No hay una sesión activa' });
  res.json({ usuario });
});




// Revisa si la cuenta puede seguir usando el sistema.
async function cuentaHabilitada(req, res) {
  const { rows: filas } = await db.query(
    'SELECT activo, debe_cambiar_contrasena FROM usuario WHERE id_usuario = $1',
    [req.session.usuario.id]
  );
  if (filas.length === 0 || !filas[0].activo) {
    req.session.destroy(() => {});
    res.status(401).json({ error: 'Debe iniciar sesión' });
    return false;
  }
  if (filas[0].debe_cambiar_contrasena) {
    res.status(403).json({ error: MENSAJES.cambioObligatorio, estado: 'cambio-obligatorio' });
    return false;
  }
  return true;
}


// Exige una sesion valida de ingeniero.
async function requiereSesion(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: 'Debe iniciar sesión' });
  }
  if (!await cuentaHabilitada(req, res)) return;
  if (req.session.usuario.rol !== ROL_INGENIERO) {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol de Ingeniero Civil' });
  }
  next();
}


module.exports = { router, requiereSesion, cuentaHabilitada, datosSesion, sesionVigente };
