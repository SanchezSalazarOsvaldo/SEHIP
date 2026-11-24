// Gestiona cuentas y datos del administrador.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const calc = require('../../public/js/validaciones');
const { enviarCorreo } = require('../correo');
const { cuentaHabilitada, datosSesion, sesionVigente } = require('./auth');
const { CONSULTA_PROYECTO, CONSULTA_SIMULACION, coeficientesNormativos, completarProyecto, completarSimulacion } = require('../resultados');
const {
  limiteInicioSesion, limiteConfiguracion, limiteCreacionCuentas,
  responderLimite, esperaPorFallos, registrarFallo, limpiarFallos
} = require('../limites');


const router = express.Router();

const ROL_ADMIN = calc.ROL_ADMINISTRADOR;



const ERROR_DUPLICADO = '23505';
const ERROR_LLAVE_FORANEA = '23503';
const ERROR_TRIGGER = 'P0001';


const ES_PROTEGIDO = 'EXISTS (SELECT 1 FROM administrador_inicial ai WHERE ai.id_usuario = u.id_usuario) AS protegido';


// Obtiene la fecha y hora actual.
function fechaHoraActual() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}




// Recibe el inicio de sesion.
router.post('/login', limiteInicioSesion, async (req, res) => {
  const datos = req.body || {};
  const correo = String(datos.correo ?? '').trim();
  const contrasena = String(datos.contrasena ?? '');
  const cuenta = correo.toLowerCase();

  const espera = esperaPorFallos(req, cuenta);
  if (espera > 0) return responderLimite(res, espera, calc.MENSAJES.demasiadosIntentos);

  if (!calc.credencialesConFormatoValido(correo, contrasena)) {
    registrarFallo(req, cuenta);
    return res.status(401).json({ error: calc.MENSAJES.adminLoginIncorrecto });
  }
  const { rows: filas } = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.contrasena_hash, u.activo, u.debe_cambiar_contrasena,
            r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
      WHERE LOWER(u.correo) = LOWER($1)`,
    [correo]
  );
  const u = filas[0];
  
  const accesoValido = u && u.rol === ROL_ADMIN && u.activo
    && await bcrypt.compare(contrasena, u.contrasena_hash);
  if (!accesoValido) {
    registrarFallo(req, cuenta);
    return res.status(401).json({ error: calc.MENSAJES.adminLoginIncorrecto });
  }
  limpiarFallos(cuenta);
  req.session.usuario = datosSesion(u);
  res.json({ usuario: req.session.usuario });
});




// Comprueba si existe el administrador inicial.
async function administradorInicialExiste() {
  const { rows: filas } = await db.query('SELECT COUNT(*) AS total FROM administrador_inicial');
  return filas[0].total > 0;
}


// Crea el primer administrador.
router.get('/configuracion-inicial', async (req, res) => {
  res.json({ pendiente: !await administradorInicialExiste() });
});


// Crea el primer administrador.
router.post('/configuracion-inicial', limiteConfiguracion, async (req, res) => {
  if (await administradorInicialExiste()) {
    return res.status(409).json({ error: calc.MENSAJES.configuracionHecha });
  }
  const datos = req.body || {};
  const nombre = String(datos.nombre ?? '').trim();
  const correo = String(datos.correo ?? '').trim();
  const contrasena = String(datos.contrasena ?? '');
  if (!calc.datosCuentaValidos(nombre, correo, ROL_ADMIN)) {
    return res.status(400).json({ error: calc.MENSAJES.cuentaInvalida });
  }
  const errorContrasena = calc.validarNuevaContrasena(contrasena, String(datos.confirmacion ?? ''));
  if (errorContrasena) return res.status(400).json({ error: errorContrasena });

  const hash = await bcrypt.hash(contrasena, 10);
  let idNuevo;
  try {
    
    
    const { rows: insertados } = await db.query(
      `WITH nueva AS (
         INSERT INTO usuario (nombre, correo, contrasena_hash, id_rol, activo)
         VALUES ($1, $2, $3, (SELECT id_rol FROM rol WHERE nombre = $4), TRUE)
         RETURNING id_usuario
       ), protegida AS (
         INSERT INTO administrador_inicial (id_usuario) SELECT id_usuario FROM nueva
       )
       SELECT id_usuario FROM nueva`,
      [nombre, correo, hash, ROL_ADMIN]
    );
    idNuevo = insertados[0].id_usuario;
  } catch (error) {
    
    if (error.code === ERROR_DUPLICADO && error.constraint === 'uq_un_administrador_inicial') {
      return res.status(409).json({ error: calc.MENSAJES.configuracionHecha });
    }
    if (error.code === ERROR_DUPLICADO) return res.status(400).json({ error: calc.MENSAJES.cuentaInvalida });
    throw error;
  }
  req.session.usuario = datosSesion({
    id_usuario: idNuevo, nombre, correo, rol: ROL_ADMIN, debe_cambiar_contrasena: false
  });
  res.status(201).json({ usuario: req.session.usuario, mensaje: calc.MENSAJES.administradorInicialCreado });
});


// Entrega los datos de la sesion activa.
router.get('/sesion', async (req, res) => {
  const usuario = await sesionVigente(req);
  if (!usuario) return res.status(401).json({ error: 'No hay una sesión activa' });
  if (usuario.rol !== ROL_ADMIN) return res.status(403).json({ error: calc.MENSAJES.accesoDenegado, usuario });
  res.json({ usuario });
});



// Exige una sesion valida de administrador.
async function requiereAdmin(req, res, next) {
  const usuario = req.session.usuario;
  if (!usuario) return res.status(401).json({ error: 'Debe iniciar sesión' });
  if (!await cuentaHabilitada(req, res)) return;
  if (usuario.rol !== ROL_ADMIN) return res.status(403).json({ error: calc.MENSAJES.accesoDenegado });
  next();
}

// Aplica esta comprobación antes de continuar.
router.use(requiereAdmin);




// Entrega los datos del panel.
router.get('/panel', async (req, res) => {
  const { rows: totales } = await db.query(
    
    `SELECT (SELECT COUNT(*) FROM proyecto) AS proyectos,
            (SELECT COUNT(*) FROM simulacion_mitigacion) AS simulaciones`
  );
  const { rows: incidencias } = await db.query(
    `SELECT p.id_punto AS id, p.latitud, p.longitud, p.fecha_registro AS "fechaRegistro", a.nombre AS alcaldia,
            p.origen, p.estado, t.nombre AS tipo, n.nombre AS "nivelAgua", p.descripcion
       FROM punto_critico p
       JOIN alcaldia a ON a.id_alcaldia = p.id_alcaldia
       JOIN tipo_incidencia t ON t.id_tipo_incidencia = p.id_tipo_incidencia
       LEFT JOIN nivel_agua n ON n.id_nivel_agua = p.id_nivel_agua
      ORDER BY p.fecha_registro DESC`
  );
  
  const coeficientes = await coeficientesNormativos();
  const { rows: filasProyectos } = await db.query(`${CONSULTA_PROYECTO} ORDER BY p.id_proyecto`);
  
  const porId = new Map();
  const proyectos = filasProyectos.map((f) => {
    completarProyecto(f, coeficientes);
    porId.set(f.id_proyecto, f);
    return {
      id: f.id_proyecto, nombre: f.nombre, latitud: f.latitud, longitud: f.longitud,
      estado: f.caudal_pico != null ? 'Calculado' : 'En proceso', fechaCreacion: f.fecha_creacion,
      superficieTotal: f.superficie_total, intensidad: f.intensidad_mm_h, caudalPico: f.caudal_pico,
      alcaldia: f.alcaldia, ingeniero: f.creador
    };
  });
  const { rows: filasSimulaciones } = await db.query(
    `${CONSULTA_SIMULACION} ORDER BY s.fecha_hora DESC, s.id_simulacion DESC`);
  const simulaciones = filasSimulaciones.map((s) => {
    completarSimulacion(s, porId.get(s.id_proyecto), coeficientes.Cp);
    return {
      id: s.id_simulacion, idProyecto: s.id_proyecto, tipoObra: s.tipo_obra, capacidad: s.capacidad_almacenamiento,
      caudalPico: s.caudal_pico, latitud: s.latitud, longitud: s.longitud, distancia: s.distancia_m,
      eficiencia: s.eficiencia, caudalAjustado: s.caudal_ajustado, caudalPermitido: s.caudal_permitido,
      fechaHora: s.fecha_hora
    };
  });
  res.json({
    totalProyectos: totales[0].proyectos,
    totalSimulaciones: totales[0].simulaciones,
    incidencias,
    proyectos,
    simulaciones,
    coeficientePermeable: coeficientes.Cp,
    fechaConsulta: fechaHoraActual(),
    mensaje: incidencias.length === 0 ? calc.MENSAJES.sinIncidencias : ''
  });
});




// Aprueba una incidencia reportada.
router.post('/incidencias/:id/aprobar', async (req, res) => {
  if (!calc.identificadorValido(req.params.id)) return res.status(404).json({ error: calc.MENSAJES.incidenciaNoEncontrada });
  const { rows: filas } = await db.query('SELECT estado FROM punto_critico WHERE id_punto = $1', [Number(req.params.id)]);
  if (filas.length === 0) return res.status(404).json({ error: calc.MENSAJES.incidenciaNoEncontrada });
  if (filas[0].estado === 'Aprobada') return res.status(400).json({ error: calc.MENSAJES.incidenciaYaAprobada });
  await db.query("UPDATE punto_critico SET estado = 'Aprobada' WHERE id_punto = $1", [Number(req.params.id)]);
  res.json({ mensaje: calc.MENSAJES.incidenciaAprobada });
});



// Consulta o elimina una incidencia.
router.delete('/incidencias/:id', async (req, res) => {
  const resultado = calc.identificadorValido(req.params.id)
    ? await db.query('DELETE FROM punto_critico WHERE id_punto = $1', [Number(req.params.id)])
    : { rowCount: 0 };
  if (resultado.rowCount === 0) return res.status(404).json({ error: calc.MENSAJES.incidenciaNoEncontrada });
  res.json({ mensaje: calc.MENSAJES.incidenciaEliminada });
});







// Lee los valores normativos guardados.
async function tablaMaestra() {
  const { rows: coef } = await db.query('SELECT tipo, valor FROM coeficiente_normativo');
  const coeficientes = { Cp: null, Ci: null };
  coef.forEach((f) => { coeficientes[f.tipo] = f.valor; });

  const { rows: filas } = await db.query(
    `SELECT a.id_alcaldia, a.nombre, i.periodo_retorno, i.intensidad_mm_h
       FROM alcaldia a
       LEFT JOIN intensidad_lluvia i ON i.id_alcaldia = a.id_alcaldia
      ORDER BY a.nombre, i.periodo_retorno`
  );
  const porAlcaldia = new Map();
  filas.forEach((f) => {
    if (!porAlcaldia.has(f.id_alcaldia)) {
      porAlcaldia.set(f.id_alcaldia, { idAlcaldia: f.id_alcaldia, alcaldia: f.nombre, valores: {} });
    }
    if (f.periodo_retorno != null) porAlcaldia.get(f.id_alcaldia).valores[f.periodo_retorno] = f.intensidad_mm_h;
  });
  return { coeficientes, intensidades: [...porAlcaldia.values()] };
}


// Consulta o cambia parámetros normativos.
router.get('/tabla-maestra', async (req, res) => {
  res.json(await tablaMaestra());
});


// Consulta o cambia parámetros normativos.
router.post('/tabla-maestra', async (req, res) => {
  const datos = req.body || {};
  const tipo = datos.tipo;
  const esIntensidad = tipo === 'intensidad';
  if (!esIntensidad && tipo !== 'Cp' && tipo !== 'Ci') {
    return res.status(400).json({ error: calc.MENSAJES.valorNoNumerico });
  }
  const validacion = calc.validarValorParametro(tipo, datos.valor);
  if (validacion.error) return res.status(400).json({ error: validacion.error });

  
  if (esIntensidad && (!calc.identificadorValido(datos.idAlcaldia) || !calc.periodoValido(Number(datos.periodo)))) {
    return res.status(400).json({ error: calc.MENSAJES.valorNoNumerico });
  }

  try {
    if (esIntensidad) {
      await db.query(
        `INSERT INTO intensidad_lluvia (id_alcaldia, periodo_retorno, intensidad_mm_h) VALUES ($2, $3, $1)
         ON CONFLICT (id_alcaldia, periodo_retorno) DO UPDATE SET intensidad_mm_h = EXCLUDED.intensidad_mm_h`,
        [validacion.valor, Number(datos.idAlcaldia), Number(datos.periodo)]
      );
    } else {
      await db.query(
        `INSERT INTO coeficiente_normativo (tipo, valor) VALUES ($2, $1)
         ON CONFLICT (tipo) DO UPDATE SET valor = EXCLUDED.valor`,
        [validacion.valor, tipo]
      );
    }
  } catch (error) {
    
    if (error.code === ERROR_LLAVE_FORANEA) return res.status(400).json({ error: calc.MENSAJES.valorNoNumerico });
    throw error;
  }

  res.json({ ...(await tablaMaestra()), mensaje: calc.MENSAJES.parametroActualizado });
});




// Consulta las cuentas y su estado.
async function todosLosUsuarios(idSesion) {
  const { rows: filas } = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.activo, ${ES_PROTEGIDO}, r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
      ORDER BY u.id_usuario`
  );
  return filas.map((f) => ({
    id: f.id_usuario, nombre: f.nombre, correo: f.correo, rol: f.rol,
    activo: f.activo, protegido: f.protegido, propio: f.id_usuario === idSesion
  }));
}


// Consulta o crea cuentas.
router.get('/usuarios', async (req, res) => {
  const usuarios = await todosLosUsuarios(req.session.usuario.id);
  if (req.query.buscar === undefined) return res.json({ usuarios });

  const texto = String(req.query.buscar);
  if (!calc.busquedaValida(texto)) return res.status(400).json({ error: calc.MENSAJES.busquedaLongitud });
  const encontrados = usuarios.filter((u) => calc.usuarioCoincide(u, texto));
  if (encontrados.length === 0) return res.status(404).json({ error: calc.MENSAJES.sinUsuarios, usuarios: [] });
  res.json({ usuarios: encontrados });
});



// Prepara el correo enviado al crear una cuenta.
function textoCuentaCreada(nombre, correo, rol, temporal) {
  const acceso = rol === ROL_ADMIN ? 'Acceso administrativo (admin.html)' : 'inicio de sesión de SEHIP';
  return `Hola ${nombre}:\n\nSe creó tu cuenta en SEHIP con el rol ${rol}.\n\n`
    + `Correo: ${correo}\nContraseña temporal: ${temporal}\n\n`
    + `Ingresa por el ${acceso}. Al iniciar sesión por primera vez se te pedirá cambiar la contraseña temporal `
    + 'por una propia.\n\nSi no esperabas este correo, ignóralo.';
}


// Consulta o crea cuentas.
router.post('/usuarios', limiteCreacionCuentas, async (req, res) => {
  const datos = req.body || {};
  const nombre = String(datos.nombre ?? '').trim();
  const correo = String(datos.correo ?? '').trim();
  const rol = datos.rol;

  if (!calc.datosCuentaValidos(nombre, correo, rol)) {
    return res.status(400).json({ error: calc.MENSAJES.cuentaInvalida });
  }
  
  const { rows: existentes } = await db.query('SELECT id_usuario FROM usuario WHERE LOWER(correo) = LOWER($1)', [correo]);
  if (existentes.length > 0) return res.status(400).json({ error: calc.MENSAJES.cuentaInvalida });

  
  const temporal = calc.generarContrasenaTemporal((n) => Array.from(crypto.randomBytes(n)));
  const hash = await bcrypt.hash(temporal, 10);
  let idNuevo;
  try {
    const { rows: insertados } = await db.query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, id_rol, activo, debe_cambiar_contrasena)
       VALUES ($1, $2, $3, (SELECT id_rol FROM rol WHERE nombre = $4), TRUE, TRUE)
       RETURNING id_usuario`,
      [nombre, correo, hash, rol]
    );
    idNuevo = insertados[0].id_usuario;
  } catch (error) {
    if (error.code === ERROR_DUPLICADO) return res.status(400).json({ error: calc.MENSAJES.cuentaInvalida });
    throw error;
  }

  
  try {
    await enviarCorreo({
      para: correo,
      asunto: 'SEHIP · Tu cuenta y contraseña temporal',
      texto: textoCuentaCreada(nombre, correo, rol, temporal)
    });
  } catch (error) {
    console.error('Fallo al enviar la contraseña temporal:', error.message);
    await db.query('DELETE FROM usuario WHERE id_usuario = $1', [idNuevo]);
    return res.status(502).json({ error: calc.MENSAJES.correoFallido });
  }

  res.status(201).json({
    usuarios: await todosLosUsuarios(req.session.usuario.id),
    mensaje: `Cuenta creada. La contraseña temporal se envió a ${correo}`
  });
});


// Busca una cuenta por su identificador.
async function buscarCuenta(idTexto) {
  if (!calc.identificadorValido(idTexto)) return null;
  const id = Number(idTexto);
  const { rows: filas } = await db.query(
    `SELECT u.id_usuario, u.activo, ${ES_PROTEGIDO}, r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = $1`,
    [id]
  );
  return filas[0] || null;
}



// Cambia el rol de una cuenta.
router.post('/usuarios/:id/rol', async (req, res) => {
  const rolNuevo = (req.body || {}).rol;
  const cuenta = await buscarCuenta(req.params.id);
  if (!cuenta) return res.status(404).json({ error: calc.MENSAJES.usuarioNoExiste });
  if (!calc.ROLES.includes(rolNuevo)) return res.status(400).json({ error: calc.MENSAJES.cuentaInvalida });
  if (cuenta.rol === rolNuevo) return res.status(400).json({ error: calc.MENSAJES.rolIgual });

  
  if (cuenta.rol === ROL_ADMIN && cuenta.activo) {
    const { rows: otros } = await db.query(
      `SELECT COUNT(*) AS total
         FROM usuario u
         JOIN rol r ON r.id_rol = u.id_rol
        WHERE r.nombre = $1 AND u.activo AND u.id_usuario <> $2`,
      [ROL_ADMIN, cuenta.id_usuario]
    );
    if (otros[0].total === 0) return res.status(400).json({ error: calc.MENSAJES.ultimoAdministrador });
  }
  if (cuenta.protegido) return res.status(400).json({ error: calc.MENSAJES.administradorProtegido });

  try {
    await db.query(
      'UPDATE usuario SET id_rol = (SELECT id_rol FROM rol WHERE nombre = $1) WHERE id_usuario = $2',
      [rolNuevo, cuenta.id_usuario]
    );
  } catch (error) {
    
    if (error.code === ERROR_TRIGGER) return res.status(400).json({ error: calc.MENSAJES.administradorProtegido });
    throw error;
  }
  res.json({ usuarios: await todosLosUsuarios(req.session.usuario.id), mensaje: calc.MENSAJES.rolModificado });
});




// Explica una parte importante de este codigo.
router.post('/usuarios/:id/desactivar', async (req, res) => {
  const cuenta = await buscarCuenta(req.params.id);
  if (!cuenta) return res.status(404).json({ error: calc.MENSAJES.usuarioNoExiste });
  if (cuenta.id_usuario === req.session.usuario.id) return res.status(400).json({ error: calc.MENSAJES.cuentaPropia });
  if (!cuenta.activo) return res.status(400).json({ error: calc.MENSAJES.cuentaYaInactiva });
  if (cuenta.protegido) return res.status(400).json({ error: calc.MENSAJES.administradorProtegido });

  try {
    await db.query('UPDATE usuario SET activo = FALSE WHERE id_usuario = $1', [cuenta.id_usuario]);
  } catch (error) {
    if (error.code === ERROR_TRIGGER) return res.status(400).json({ error: calc.MENSAJES.administradorProtegido });
    throw error;
  }
  res.json({ usuarios: await todosLosUsuarios(req.session.usuario.id), mensaje: calc.MENSAJES.cuentaDesactivada });
});



// Explica una parte importante de este codigo.
router.post('/usuarios/:id/reactivar', async (req, res) => {
  const cuenta = await buscarCuenta(req.params.id);
  if (!cuenta) return res.status(404).json({ error: calc.MENSAJES.usuarioNoExiste });
  if (cuenta.activo) return res.status(400).json({ error: calc.MENSAJES.cuentaYaActiva });

  await db.query('UPDATE usuario SET activo = TRUE WHERE id_usuario = $1', [cuenta.id_usuario]);
  res.json({ usuarios: await todosLosUsuarios(req.session.usuario.id), mensaje: calc.MENSAJES.cuentaReactivada });
});




// Explica una parte importante de este codigo.
router.delete('/usuarios/:id', async (req, res) => {
  const cuenta = await buscarCuenta(req.params.id);
  if (!cuenta) return res.status(404).json({ error: calc.MENSAJES.usuarioNoExiste });
  if (cuenta.id_usuario === req.session.usuario.id) {
    return res.status(400).json({ error: calc.MENSAJES.cuentaPropiaNoEliminable });
  }
  if (cuenta.protegido) return res.status(400).json({ error: calc.MENSAJES.administradorNoEliminable });
  if (cuenta.activo) return res.status(400).json({ error: calc.MENSAJES.cuentaActivaNoEliminable });

  try {
    await db.query(
      
      `WITH proyectos AS (SELECT id_proyecto FROM proyecto WHERE id_usuario = $1),
            reportes AS (DELETE FROM reporte_pdf WHERE id_proyecto IN (SELECT id_proyecto FROM proyectos)),
            simulaciones AS (DELETE FROM simulacion_mitigacion WHERE id_proyecto IN (SELECT id_proyecto FROM proyectos)),
            proyectos_borrados AS (DELETE FROM proyecto WHERE id_usuario = $1)
       DELETE FROM usuario WHERE id_usuario = $1`,
      [cuenta.id_usuario]
    );
  } catch (error) {
    
    if (error.code === ERROR_LLAVE_FORANEA) return res.status(400).json({ error: calc.MENSAJES.administradorNoEliminable });
    throw error;
  }
  res.json({ usuarios: await todosLosUsuarios(req.session.usuario.id), mensaje: calc.MENSAJES.cuentaEliminada });
});


module.exports = router;
