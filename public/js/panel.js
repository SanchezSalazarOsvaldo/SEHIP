// Un solo objeto estado guarda lo que la pantalla necesita y pintarTodo() redibuja todo a partir de él; así la pantalla nunca muestra datos mezclados.
// No se modifica la pantalla en cada evento por separado porque es fácil que una parte quede desactualizada. escapar() evita inyección de HTML con nombres escritos por el usuario.
// Panel del ingeniero civil. Las pestañas (Proyectos, Cálculo, Mitigación y Reporte) comparten un mapa
// siempre visible donde se dibuja la simulación del proyecto activo.
// Funciona con un objeto estado: cada respuesta del servidor actualiza estado y después pintarTodo()
// vuelve a dibujar la pantalla completa a partir de él, así la pantalla nunca muestra datos mezclados.
// Las peticiones al servidor están en js/proyectos.js y las fórmulas en js/validaciones.js.

// Datos que necesita la pantalla en este momento.
const estado = {
  usuario: null,
  proycto: null,            // proyecto activo
  simulaciones: [],          // simulaciones guardadas del proyecto activo (la más reciente primero)
  simulacionVigente: null,   // última simulación hecha con los datos y la ubicación actuales
  pagina: 1,
  alcaldias: [],
  coeficientes: null,        // Cp y Ci vigentes
  punto: null,               // { latitud, longitud, alcaldia } del proyecto por registrar
  obra: null,                // { latitud, longitud, distancia, eficiencia } de la obra por simular
  reportes: [],
  miembros: [],              // creador e ingenieros invitados del proyecto activo
  intensidades: { idAlcaldia: null, valores: null },  // intensidades de la alcaldía del proyecto activo
  pestana: 'proyectos'
};

// Texto de ayuda que aparece sobre el mapa según la pestaña abierta.
const INSTRUCCIONES_MAPA = {
  proyectos: {
    nuevo: 'Haga clic en el mapa para colocar el punto del nuevo proyecto. Puede arrastrar el pin para ajustarlo.',
    activo: 'Arrastre el pin o haga clic en otro punto para mover el proyecto activo.'
  },
  calculo: 'El círculo de color es la zona afectada: crece con el agua que el terreno ya no puede desalojar.',
  mitigacion: 'Haga clic dentro de la zona afectada para colocar la obra; la vista previa se actualiza al escribir su capacidad.',
  reporte: 'El reporte incluye la ubicación, la zona afectada y el semáforo antes y después de la obra.'
};

// Atajo para buscar un elemento de la página por su id.
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------

// Convierte un texto en HTML seguro: un nombre como <script> se muestra como texto y no se ejecuta.
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Número con separador de miles y los decimales indicados (formato de México); '-' si no hay valor.
function numero(valor, decimales) {
  if (valor === null || valor === undefined) return null;
  return Number(valor).toLocaleString('es-MX', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  });
}

function numeroCorto(valor, maximo = 2) {
  return Number(valor).toLocaleString('es-MX', { maximumFractionDigits: maximo });
}

// Escribe un resultado (con su unidad) en el elemento indicado.
function pintarMetrica(id, valor, decimales, unidad = '') {
  const elemento = $(id);
  const texto = numero(valor, decimales);
  elemento.classList.toggle('sin-calcular', texto === null);
  elemento.textContent = texto === null ? 'Sin calcular' : `${texto}${unidad}`;
}

// Muestra un aviso de error, éxito o información dentro de una tarjeta.
function mostrarMensaje(idContenedor, tipo, texto) {
  const iconos = { error: 'i-triangulo', exito: 'i-check', info: 'i-info' };
  $(idContenedor).innerHTML = `
    <div class="alerta alerta-${tipo}" role="${tipo === 'error' ? 'alert' : 'status'}">
      <svg class="icono"><use href="#${iconos[tipo]}"/></svg>
      <span>${escapar(texto)}</span>
    </div>`;
}

// Borra los avisos de todas las tarjetas antes de una nueva acción.
function limpiarMensajes() {
  ['msg-proyecto', 'msg-historial', 'msg-ubicacion', 'msg-coeficiente', 'msg-intensidad', 'msg-caudal',
    'msg-mitigacion', 'msg-reporte'].forEach((id) => { $(id).innerHTML = ''; });
}

// Aviso breve en la parte inferior de la pantalla que desaparece solo a los pocos segundos.
let temporizadorSnackbar;
function snackbar(texto) {
  const caja = $('snackbar');
  caja.querySelector('span').textContent = texto;
  caja.classList.remove('oculto');
  clearTimeout(temporizadorSnackbar);
  temporizadorSnackbar = setTimeout(() => caja.classList.add('oculto'), 4000);
}

// Clase CSS de la etiqueta de estado: verde si está Calculado, gris si está En proceso.
function claseEstado(estadoProyecto) {
  return estadoProyecto === 'Calculado' ? 'chip-calculado' : 'chip-proceso';
}

// Busca el id de una alcaldía por su nombre (el mapa trabaja con nombres y el servidor con ids).
function idAlcaldiaPorNombre(nombre) {
  const alcaldia = estado.alcaldias.find((a) => a.nombre === nombre);
  return alcaldia ? alcaldia.id : '';
}

// Busca el nombre de una alcaldía gracias por su id.
function nombreAlcaldiaPorId(id) {
  const alcaldia = estado.alcaldias.find((a) => String(a.id) === String(id));
  return alcaldia ? alcaldia.nombre : null;
}

// ---------- Modelo de la simulación ----------

// Caudal que el terreno descargaría sin construcción (Cp en lugar de C); es el límite del semáforo.
function caudalPermitidoProyecto(p) {
  if (!estado.coeficientes || estado.coeficientes.Cp == null || p.intensidad == null || p.superficieTotal == null) {
    return null;
  }
  return calcularCaudalPico(estado.coeficientes.Cp, p.intensidad, p.superficieTotal);
}

// Escenario: caudal, semáforo y radio de la zona afectada en rojo.
function escenario(p, caudal, permitido) {
  return {
    caudal,            
    permitido,
    evaluacion: evaluarSemaforo(caudal, permitido),
    radio: radioAfectacion(p.superficieTotal, caudal, permitido),
    area: areaZonaAfectada(p.superficieTotal, caudal, permitido)
  };
}

// de obra no cambia el cálculo: solo se exige al guardar la simulación.
function obraEnPreparacion() {
  const capacidad = leerCapacidad($('capacidad').value);
  if (!estado.obra || capacidad === null) return null;
  return { ...estado.obra, capacidad, tipoObra: $('tipo-obra').value };
}

// Escenarios del proyecto activo: sin obra (antes), con la obra guardada actualizada.
function modeloSimulacion() {
  const p = estado.proyecto;
  const modelo = { permitido: null, antes: null, despues: null, previa: null, actual: null };
  if (!p) return modelo;
  modelo.permitido = caudalPermitidoProyecto(p);
  if (p.caudalPico == null || modelo.permitido == null) return modelo;

  modelo.antes = escenario(p, p.caudalPico, modelo.permitido);

  const s = estado.simulacionVigente;
  if (s) modelo.despues = { ...escenario(p, s.caudalAjustado, s.caudalPermitido), obra: s };

  const obra = obraEnPreparacion();
  if (obra && estado.pestana === 'mitigacion') {
    const r = simularMitigacion({
      caudalPico: p.caudalPico, capacidad: obra.capacidad, cp: estado.coeficientes.Cp,
      intensidad: p.intensidad, superficieM2: p.superficieTotal, eficiencia: obra.eficiencia
    });
    modelo.previa = { ...escenario(p, r.caudalAjustado, r.caudalPermitido), obra: { ...obra, ...r } };
  }
  modelo.actual = modelo.despues || modelo.antes;
  return modelo;
}
