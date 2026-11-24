// Entrega datos publicos y recibe reportes ciudadanos.
const express = require('express');
const db = require('../db');
const calc = require('../../public/js/validaciones');
const { alcaldiaEnPunto } = require('../../public/js/limites-alcaldias');
const { limiteReportesCiudadanos } = require('../limites');


const router = express.Router();


const MAXIMO_PENDIENTES = 300;



// Realiza una tarea importante de este modulo.
function fechaHoraActual() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
}



// Atiende una accion o consulta de este modulo.
router.get('/catalogo', async (req, res) => {
  
  const { rows: alcaldias } = await db.query('SELECT id_alcaldia AS id, nombre FROM alcaldia ORDER BY nombre');
  const { rows: intensidades } = await db.query(
    `SELECT id_alcaldia AS "idAlcaldia", periodo_retorno AS periodo, intensidad_mm_h AS intensidad
       FROM intensidad_lluvia
      WHERE intensidad_mm_h IS NOT NULL`
  );
  const { rows: coef } = await db.query('SELECT tipo, valor FROM coeficiente_normativo');
  const coeficientes = { Cp: null, Ci: null };
  coef.forEach((f) => { coeficientes[f.tipo] = f.valor; });
  res.json({ alcaldias, intensidades, coeficientes, actualizado: fechaHoraActual() });
});


// Atiende una accion o consulta de este modulo.
router.get('/incidencias', async (req, res) => {
  const { rows: incidencias } = await db.query(
    `SELECT p.id_punto AS id, p.id_alcaldia AS "idAlcaldia", a.nombre AS alcaldia, p.latitud, p.longitud,
            p.fecha_registro AS "fechaRegistro", t.nombre AS tipo, n.nombre AS "nivelAgua", p.origen
       FROM punto_critico p
       JOIN alcaldia a ON a.id_alcaldia = p.id_alcaldia
       JOIN tipo_incidencia t ON t.id_tipo_incidencia = p.id_tipo_incidencia
       LEFT JOIN nivel_agua n ON n.id_nivel_agua = p.id_nivel_agua
      WHERE p.estado = 'Aprobada'
      ORDER BY p.fecha_registro DESC
      LIMIT 2000`
  );
  res.json({ incidencias });
});



// Atiende una accion o consulta de este modulo.
router.post('/incidencias', limiteReportesCiudadanos, async (req, res) => {
  const datos = req.body || {};
  const tipo = datos.tipo;
  const nivelAgua = datos.nivelAgua;
  const descripcion = String(datos.descripcion ?? '').trim();
  const latitud = Number(datos.latitud);
  const longitud = Number(datos.longitud);

  
  
  const error = calc.validarReporteIncidencia(tipo, nivelAgua, descripcion);
  if (error) return res.status(400).json({ error });
  
  const alcaldia = calc.coordenadasValidas(latitud, longitud) ? alcaldiaEnPunto(latitud, longitud) : null;
  if (!alcaldia) return res.status(400).json({ error: calc.MENSAJES.ubicacionFuera });

  
  const { rows: pendientes } = await db.query("SELECT COUNT(*) AS total FROM punto_critico WHERE estado = 'Pendiente'");
  if (pendientes[0].total >= MAXIMO_PENDIENTES) return res.status(429).json({ error: calc.MENSAJES.reportesSaturados });

  
  
  await db.query(
    `INSERT INTO punto_critico
       (id_alcaldia, latitud, longitud, origen, estado, id_tipo_incidencia, id_nivel_agua, descripcion)
     VALUES ((SELECT id_alcaldia FROM alcaldia WHERE nombre = $1), $2, $3, 'Ciudadano', 'Pendiente',
             (SELECT id_tipo_incidencia FROM tipo_incidencia WHERE nombre = $4),
             (SELECT id_nivel_agua FROM nivel_agua WHERE nombre = $5), $6)`,
    [alcaldia, Number(latitud.toFixed(6)), Number(longitud.toFixed(6)), tipo, nivelAgua, descripcion || null]
  );
  res.status(201).json({ mensaje: calc.MENSAJES.reporteRecibido, alcaldia });
});


module.exports = router;
