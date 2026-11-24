// Permite cambiar o recuperar la contraseña.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const calc = require('../../public/js/validaciones');
const { enviarCorreo } = require('../correo');
const {
  limiteSolicitudCodigo, limiteRestablecer, codigosPorCorreo,
  responderLimite, esperaPorFallos, registrarFallo, limpiarFallos
} = require('../limites');


const router = express.Router();

const aleatorios = (n) => Array.from(crypto.randomBytes(n));




// Cambia la contraseña actual.
router.post('/contrasena', async (req, res) => {
  const usuario = req.session.usuario;
  if (!usuario) return res.status(401).json({ error: 'Debe iniciar sesión' });

  const datos = req.body || {};
  const actual = String(datos.actual ?? '');
  const nueva = String(datos.nueva ?? '');
  const confirmacion = String(datos.confirmacion ?? '');

  const { rows: filas } = await db.query(
    
    'SELECT contrasena_hash, activo FROM usuario WHERE id_usuario = $1',
    [usuario.id]
  );
  if (filas.length === 0 || !filas[0].activo) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Debe iniciar sesión' });
  }
  
  const cuenta = `id:${usuario.id}`;
  const espera = esperaPorFallos(req, cuenta);
  if (espera > 0) return responderLimite(res, espera, calc.MENSAJES.demasiadosIntentos);
  if (!await bcrypt.compare(actual, filas[0].contrasena_hash)) {
    registrarFallo(req, cuenta);
    return res.status(400).json({ error: calc.MENSAJES.contrasenaActualIncorrecta });
  }
  limpiarFallos(cuenta);
  
  const error = calc.validarNuevaContrasena(nueva, confirmacion, actual);
  if (error) return res.status(400).json({ error });

  await db.query(
    
    'UPDATE usuario SET contrasena_hash = $1, debe_cambiar_contrasena = FALSE WHERE id_usuario = $2',
    [await bcrypt.hash(nueva, 10), usuario.id]
  );
  req.session.usuario = { ...usuario, debeCambiarContrasena: false };
  res.json({ usuario: req.session.usuario, mensaje: calc.MENSAJES.contrasenaActualizada });
});








// Solicita un código de recuperación.
router.post('/recuperacion/solicitar', limiteSolicitudCodigo, async (req, res) => {
  const correo = String((req.body || {}).correo ?? '').trim();
  if (!calc.correoValido(correo)) return res.status(400).json({ error: calc.MENSAJES.correoInvalido });

  
  const espera = codigosPorCorreo.registrar(correo.toLowerCase());
  if (espera > 0) return responderLimite(res, espera, calc.MENSAJES.demasiadosCodigos);

  
  delete req.session.recuperacion;
  const { rows: filas } = await db.query(
    'SELECT id_usuario, nombre FROM usuario WHERE LOWER(correo) = LOWER($1) AND activo',
    [correo]
  );
  if (filas.length > 0) {
    const cuenta = filas[0];
    const codigo = calc.generarCodigoRecuperacion(aleatorios);
    try {
      await enviarCorreo({
        para: correo,
        asunto: 'SEHIP · Código para restablecer tu contraseña',
        texto: `Hola ${cuenta.nombre}:\n\nTu código de verificación es: ${codigo}\n\n`
          + `Es válido por ${calc.MINUTOS_VIGENCIA_CODIGO} minutos y solo puede usarse una vez.\n`
          + 'Si no solicitaste restablecer tu contraseña, ignora este correo; tu contraseña actual sigue funcionando.'
      });
    } catch (error) {
      console.error('Fallo al enviar el código de recuperación:', error.message);
      return res.status(502).json({ error: calc.MENSAJES.codigoFallido });
    }
    
    
    req.session.recuperacion = {
      idUsuario: cuenta.id_usuario,
      correo: correo.toLowerCase(),
      codigoHash: await bcrypt.hash(codigo, 10),
      expira: Date.now() + calc.MINUTOS_VIGENCIA_CODIGO * 60 * 1000,
      intentos: 0
    };
  }
  res.json({ mensaje: calc.MENSAJES.codigoEnviado });
});



// Comprueba el código y cambia la contraseña.
router.post('/recuperacion/restablecer', limiteRestablecer, async (req, res) => {
  const datos = req.body || {};
  const correo = String(datos.correo ?? '').trim();
  const codigo = String(datos.codigo ?? '').trim();
  const nueva = String(datos.nueva ?? '');

  
  const errorContrasena = calc.validarNuevaContrasena(nueva, String(datos.confirmacion ?? ''));
  if (errorContrasena) return res.status(400).json({ error: errorContrasena });
  if (!calc.correoValido(correo) || !calc.codigoRecuperacionValido(codigo)) {
    return res.status(400).json({ error: calc.MENSAJES.codigoInvalido });
  }

  
  const tramite = req.session.recuperacion;
  const codigoUtilizable = tramite && tramite.correo === correo.toLowerCase()
    && tramite.expira > Date.now() && tramite.intentos < calc.INTENTOS_MAXIMOS_CODIGO;
  if (!codigoUtilizable) return res.status(400).json({ error: calc.MENSAJES.codigoInvalido });

  if (!await bcrypt.compare(codigo, tramite.codigoHash)) {
    
    tramite.intentos += 1;
    return res.status(400).json({ error: calc.MENSAJES.codigoInvalido });
  }

  const resultado = await db.query(
    
    'UPDATE usuario SET contrasena_hash = $1, debe_cambiar_contrasena = FALSE WHERE id_usuario = $2 AND activo',
    [await bcrypt.hash(nueva, 10), tramite.idUsuario]
  );
  delete req.session.recuperacion;
  if (resultado.rowCount === 0) return res.status(400).json({ error: calc.MENSAJES.codigoInvalido });
  res.json({ mensaje: calc.MENSAJES.contrasenaRestablecida });
});


module.exports = router;
