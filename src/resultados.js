// Calcula los resultados hidrologicos del proyecto.
const db = require('./db');
const calc = require('../public/js/validaciones');



const CONSULTA_PROYECTO = `
  SELECT p.*, a.nombre AS alcaldia, u.nombre AS creador, i.intensidad_mm_h
    FROM proyecto p
    JOIN alcaldia a ON a.id_alcaldia = p.id_alcaldia
    JOIN usuario u ON u.id_usuario = p.id_usuario
    LEFT JOIN intensidad_lluvia i ON i.id_alcaldia = p.id_alcaldia AND i.periodo_retorno = p.periodo_retorno`;


const CONSULTA_SIMULACION = `
  SELECT s.*, t.nombre AS tipo_obra
    FROM simulacion_mitigacion s
    JOIN tipo_obra t ON t.id_tipo_obra = s.id_tipo_obra`;


// Realiza una tarea importante de este modulo.
function condicionAcceso(n) {
  return `(p.id_usuario = $${n} OR EXISTS (
    SELECT 1 FROM proyecto_ingeniero m WHERE m.id_proyecto = p.id_proyecto AND m.id_usuario = $${n}))`;
}


// Realiza una tarea importante de este modulo.
async function coeficientesNormativos() {
  const { rows: filas } = await db.query('SELECT tipo, valor FROM coeficiente_normativo');
  const coeficientes = { Cp: null, Ci: null };
  filas.forEach((fila) => { coeficientes[fila.tipo] = fila.valor; });
  return coeficientes;
}



// Realiza una tarea importante de este modulo.
function completarProyecto(fila, { Cp, Ci }) {
  const conSuperficies = fila.superficie_permeable != null && fila.superficie_impermeable != null;
  fila.superficie_total = conSuperficies
    ? calc.redondear(fila.superficie_permeable + fila.superficie_impermeable, 2)
    : null;
  fila.coeficiente_c = conSuperficies && Cp != null && Ci != null
    ? calc.calcularCoeficiente(Cp, Ci, fila.superficie_permeable, fila.superficie_impermeable)
    : null;
  if (fila.intensidad_mm_h === undefined) fila.intensidad_mm_h = null;
  fila.caudal_pico = null;
  const error = calc.validarParametrosCaudal(fila.coeficiente_c, fila.intensidad_mm_h, fila.superficie_total);
  if (fila.estado === 'Calculado' && !error) {
    fila.caudal_pico = calc.calcularCaudalPico(fila.coeficiente_c, fila.intensidad_mm_h, fila.superficie_total);
  }
  return fila;
}




// Realiza una tarea importante de este modulo.
function completarSimulacion(fila, proyecto, Cp) {
  fila.distancia_m = calc.redondear(
    calc.distanciaMetros(proyecto.latitud, proyecto.longitud, fila.latitud, fila.longitud), 2);
  Object.assign(fila, {
    caudal_pico: null, eficiencia: null, retencion: null,
    caudal_ajustado: null, caudal_permitido: null, dentro_de_capacidad: false
  });
  if (proyecto.caudal_pico == null || Cp == null) return fila;

  const permitido = calc.calcularCaudalPico(Cp, proyecto.intensidad_mm_h, proyecto.superficie_total);
  const radio = calc.radioAfectacion(proyecto.superficie_total, proyecto.caudal_pico, permitido);
  const eficiencia = calc.eficienciaPorUbicacion(fila.distancia_m, radio);
  if (eficiencia === null) return fila;

  const r = calc.simularMitigacion({
    caudalPico: proyecto.caudal_pico,
    capacidad: fila.capacidad_almacenamiento,
    cp: Cp,
    intensidad: proyecto.intensidad_mm_h,
    superficieM2: proyecto.superficie_total,
    eficiencia
  });
  Object.assign(fila, {
    caudal_pico: proyecto.caudal_pico,
    eficiencia,
    retencion: r.retencion,
    caudal_ajustado: r.caudalAjustado,
    caudal_permitido: r.caudalPermitido,
    dentro_de_capacidad: r.dentroDeCapacidad
  });
  return fila;
}


module.exports = {
  CONSULTA_PROYECTO, CONSULTA_SIMULACION, condicionAcceso,
  coeficientesNormativos, completarProyecto, completarSimulacion
};
