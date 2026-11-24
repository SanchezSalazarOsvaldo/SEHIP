// Administra proyectos, simulaciones y reportes.
const express = require('express');
const db = require('../db');
const { requiereSesion } = require('./auth');
const calc = require('../../public/js/validaciones');
const { alcaldiaEnPunto } = require('../../public/js/limites-alcaldias');
const {
  CONSULTA_PROYECTO, CONSULTA_SIMULACION, condicionAcceso,
  coeficientesNormativos, completarProyecto, completarSimulacion
} = require('../resultados');


const router = express.Router();

const PROYECTOS_POR_PAGINA = 10;


const PROYECTOS_POR_DIA = 100;
const BYTES_REPORTES_POR_DIA = 25 * 1024 * 1024;   


// Atiende una accion o consulta de este modulo.
router.use(requiereSesion);





// Realiza una tarea importante de este modulo.
function aProyecto(f, idUsuario) {
  return {
    id: f.id_proyecto,
    idUsuario: f.id_usuario,
    creador: f.creador,
    esCreador: f.id_usuario === idUsuario,
    nombre: f.nombre,
    idAlcaldia: f.id_alcaldia,
    alcaldia: f.alcaldia,
    latitud: f.latitud,
    longitud: f.longitud,
    fechaCreacion: f.fecha_creacion,
    estado: f.caudal_pico != null ? 'Calculado' : 'En proceso',
    superficiePermeable: f.superficie_permeable,
    superficieImpermeable: f.superficie_impermeable,
    superficieTotal: f.superficie_total,
    coeficiente: f.coeficiente_c,
    intensidad: f.intensidad_mm_h,
    periodoRetorno: f.periodo_retorno,
    caudalPico: f.caudal_pico
  };
}


// Realiza una tarea importante de este modulo.
function aSimulacion(f) {
  return {
    id: f.id_simulacion,
    idProyecto: f.id_proyecto,
    tipoObra: f.tipo_obra,
    capacidad: f.capacidad_almacenamiento,
    caudalPico: f.caudal_pico,
    latitud: f.latitud,
    longitud: f.longitud,
    distancia: f.distancia_m,
    eficiencia: f.eficiencia,
    retencion: f.retencion,
    caudalAjustado: f.caudal_ajustado,
    caudalPermitido: f.caudal_permitido,
    dentroDeCapacidad: f.dentro_de_capacidad === true,
    fechaHora: f.fecha_hora
  };
}



const COLUMNAS_REPORTE = `r.id_reporte, r.id_proyecto, r.fecha_generacion,
  'SEHIP_Reporte_Proyecto_' || r.id_proyecto || '_' || TO_CHAR(r.fecha_generacion, 'YYYY-MM-DD') || '.pdf' AS nombre_archivo,
  OCTET_LENGTH(r.contenido) AS tamano_bytes`;



// Realiza una tarea importante de este modulo.
function aReporte(f) {
  return {
    id: f.id_reporte,
    idProyecto: f.id_proyecto,
    nombreArchivo: f.nombre_archivo,
    tamanoBytes: f.tamano_bytes,
    fechaGeneracion: f.fecha_generacion,
    url: `/api/reportes/${f.id_reporte}/descargar`
  };
}




// Realiza una tarea importante de este modulo.
async function buscarProyecto(idTexto, idUsuario, coeficientes) {
  if (!calc.identificadorValido(idTexto)) return null;
  const { rows: filas } = await db.query(
    `${CONSULTA_PROYECTO} WHERE p.id_proyecto = $1 AND ${condicionAcceso(2)}`,
    [Number(idTexto), idUsuario]
  );
  return filas[0] ? completarProyecto(filas[0], coeficientes || await coeficientesNormativos()) : null;
}


// Realiza una tarea importante de este modulo.
function textoRecalculo(caudal) {
  return caudal != null ? ` · Caudal pico recalculado: ${caudal.toFixed(3)} m³/s` : '';
}


// Realiza una tarea importante de este modulo.
function resultadosCon(fila, cambios, coeficientes) {
  return completarProyecto({ ...fila, ...cambios }, coeficientes);
}



// Realiza una tarea importante de este modulo.
async function cargarProyecto(req, res, next) {
  req.coeficientes = await coeficientesNormativos();
  const fila = await buscarProyecto(req.params.id, req.session.usuario.id, req.coeficientes);
  if (!fila) {
    return res.status(404).json({ error: calc.MENSAJES.proyectoNoEncontrado });
  }
  req.fila = fila;
  next();
}


// Realiza una tarea importante de este modulo.
function soloCreador(req, res, next) {
  if (req.fila.id_usuario !== req.session.usuario.id) {
    return res.status(403).json({ error: calc.MENSAJES.soloCreador });
  }
  next();
}


// Realiza una tarea importante de este modulo.
async function miembrosDelProyecto(fila) {
  const { rows: invitados } = await db.query(
    `SELECT u.id_usuario AS id, u.nombre, u.correo
       FROM proyecto_ingeniero m
       JOIN usuario u ON u.id_usuario = m.id_usuario
      WHERE m.id_proyecto = $1
      ORDER BY u.nombre`,
    [fila.id_proyecto]
  );
  const { rows: creador } = await db.query(
    'SELECT id_usuario AS id, nombre, correo FROM usuario WHERE id_usuario = $1', [fila.id_usuario]);
  return [{ ...creador[0], esCreador: true }, ...invitados.map((m) => ({ ...m, esCreador: false }))];
}


// Realiza una tarea importante de este modulo.
async function responderProyecto(res, idProyecto, idUsuario, mensaje = '') {
  const coeficientes = await coeficientesNormativos();
  const fila = await buscarProyecto(idProyecto, idUsuario, coeficientes);
  const { rows: simulaciones } = await db.query(
    `${CONSULTA_SIMULACION} WHERE s.id_proyecto = $1
      ORDER BY s.fecha_hora DESC, s.id_simulacion DESC`,
    [idProyecto]
  );
  const { rows: reportes } = await db.query(
    `SELECT ${COLUMNAS_REPORTE}
       FROM reporte_pdf r WHERE r.id_proyecto = $1
      ORDER BY r.fecha_generacion DESC, r.id_reporte DESC`,
    [idProyecto]
  );
  const listaSimulaciones = simulaciones.map((s) => aSimulacion(completarSimulacion(s, fila, coeficientes.Cp)));
  res.json({
    proyecto: aProyecto(fila, idUsuario),
    simulacion: listaSimulaciones[0] || null,
    simulaciones: listaSimulaciones,
    reportes: reportes.map(aReporte),
    miembros: await miembrosDelProyecto(fila),
    mensaje
  });
}




// Atiende una accion o consulta de este modulo.
router.get('/alcaldias', async (req, res) => {
  const { rows: filas } = await db.query('SELECT id_alcaldia AS id, nombre FROM alcaldia ORDER BY nombre');
  res.json({ alcaldias: filas });
});


// Atiende una accion o consulta de este modulo.
router.get('/coeficientes', async (req, res) => {
  res.json({ coeficientes: await coeficientesNormativos() });
});


// Atiende una accion o consulta de este modulo.
router.get('/alcaldias/:id/intensidades', async (req, res) => {
  if (!calc.identificadorValido(req.params.id)) {
    return res.status(400).json({ error: calc.MENSAJES.periodoInvalido });
  }
  const { rows: filas } = await db.query(
    'SELECT periodo_retorno, intensidad_mm_h FROM intensidad_lluvia WHERE id_alcaldia = $1 ORDER BY periodo_retorno',
    [Number(req.params.id)]
  );
  const intensidades = {};
  filas.forEach((f) => { intensidades[f.periodo_retorno] = f.intensidad_mm_h; });
  res.json({ intensidades });
});


// Atiende una accion o consulta de este modulo.
router.get('/proyectos', async (req, res) => {
  const idUsuario = req.session.usuario.id;

  const { rows: conteo } = await db.query(
    
    `SELECT COUNT(*) AS total FROM proyecto p WHERE ${condicionAcceso(1)}`, [idUsuario]);
  const total = conteo[0].total;
  if (total === 0) {
    return res.status(404).json({ proyectos: [], error: calc.MENSAJES.proyectoNoEncontrado });
  }

  const totalPaginas = Math.ceil(total / PROYECTOS_POR_PAGINA);
  
  const pagina = Math.min(Math.max(1, parseInt(req.query.pagina, 10) || 1), totalPaginas);

  const coeficientes = await coeficientesNormativos();
  const { rows: filas } = await db.query(
    `${CONSULTA_PROYECTO}
      WHERE ${condicionAcceso(1)}
      ORDER BY p.fecha_creacion DESC, p.id_proyecto DESC
      LIMIT $2 OFFSET $3`,
    [idUsuario, PROYECTOS_POR_PAGINA, (pagina - 1) * PROYECTOS_POR_PAGINA]
  );

  res.json({
    proyectos: filas.map((f) => aProyecto(completarProyecto(f, coeficientes), idUsuario)),
    pagina,
    totalPaginas
  });
});
