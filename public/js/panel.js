
// Por qué así: un solo objeto estado guarda lo que la pantalla necesita y pintarTodo() redibuja todo a partir de él; así la pantalla nunca muestra datos mezclados.
// Por qué no modificar la pantalla en cada evento por separado: es fácil que una parte quede desactualizada. escapar() evita inyección de HTML con nombres escritos por el usuario.
// Panel del ingeniero civil. Las pestañas (Proyectos, Cálculo, Mitigación y Reporte) comparten un mapa
// siempre visible donde se dibuja la simulación del proyecto activo.
// Funciona con un objeto estado: cada respuesta del servidor actualiza estado y después pintarTodo()
// vuelve a dibujar la pantalla completa a partir de él, así la pantalla nunca muestra datos mezclados.
// Las peticiones al servidor están en js/proyectos.js y las fórmulas en js/validaciones.js.

// Datos que necesita la pantalla en este momento.
const estado = {
  usuario: null,
  proyecto: null,            // proyecto activo
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

// Número con hasta `maximo` decimales, sin ceros sobrantes.
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

// Clase CSS de la etiqueta de estado: verde si está Calculado.
function claseEstado(estadoProyecto) {
  return estadoProyecto === 'Calculado' ? 'chip-calculado' : 'chip-proceso';
}

// Busca el id de una alcaldía por su nombre
function idAlcaldiaPorNombre(nombre) {
  const alcaldia = estado.alcaldias.find((a) => a.nombre === nombre);
  return alcaldia ? alcaldia.id : '';
}

// Busca el nombre de una alcaldía por su id.
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

// Escenario: caudal, semáforo y radio de la zona afectada.
function escenario(p, caudal, permitido) {
  return {
    caudal,
    permitido,
    evaluacion: evaluarSemaforo(caudal, permitido),
    radio: radioAfectacion(p.superficieTotal, caudal, permitido),
    area: areaZonaAfectada(p.superficieTotal, caudal, permitido)
  };
}

// Datos de la obra que se está colocando si la capacidad y la ubicación son válidas. El tipo
// de obra no cambia el cálculo: solo se exige al guardar la simulación.
function obraEnPreparacion() {
  const capacidad = leerCapacidad($('capacidad').value);
  if (!estado.obra || capacidad === null) return null;
  return { ...estado.obra, capacidad, tipoObra: $('tipo-obra').value };
}

// Escenarios del proyecto activo: sin obra (antes), con la obra guardada vigente y vista previa.
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
// El semáforo y el medidor solo dibujan resultados que ya calcularon las fórmulas de validaciones.js; panel.js no repite fórmulas.
// Por qué no calcular aquí con otra fórmula: si el navegador y el servidor calcularan distinto, mostrarían números diferentes.
// ---------- Semáforo (tarjetas) ----------

// HTML del semáforo de tres luces con la luz del nivel encendida y el porcentaje.
function htmlSemaforo(esc, etiquetaCaudal) {
  if (!esc) {
    return '<p class="texto-vacio">Sin calcular. Calcule el caudal pico del proyecto para evaluar el riesgo.</p>';
  }
  const e = esc.evaluacion;
  const luz = (color) => `<span class="luz luz-${color} ${e.nivel === color ? 'encendida' : ''}"></span>`;
  return `
    <div class="semaforo semaforo-${e.nivel}" role="img" aria-label="Semáforo: ${e.etiqueta}">
      <div class="semaforo-caja">${luz('rojo')}${luz('amarillo')}${luz('verde')}</div>
      <div class="semaforo-texto">
        <strong>${e.etiqueta}</strong>
        <p>${e.descripcion}</p>
        <div class="semaforo-datos">
          <span>${etiquetaCaudal}: <b>${numero(esc.caudal, 3)} m³/s</b></span>
          <span>Descarga permitida: <b>${numero(esc.permitido, 3)} m³/s</b></span>
          ${e.porcentaje !== null ? `<span>Relación: <b>${e.porcentaje} %</b> de lo permitido</span>` : ''}
          <span>Volumen excedente en 1 h: <b>${numero(volumenExcedente(esc.caudal, esc.permitido), 0)} m³</b></span>
          <span>Zona afectada: <b>${numero(esc.radio, 1)} m</b> de radio (${numero(esc.area, 0)} m²)</span>
        </div>
      </div>
    </div>`;
}

// Etiqueta pequeña con el nivel del semáforo, para tablas y listas.
function chipSemaforo(evaluacion) {
  return `<span class="chip-semaforo" style="--color-nivel:${COLORES_SEMAFORO[evaluacion.nivel]}">${evaluacion.etiqueta}</span>`;
}

// ---------- Medidor de riesgo ----------

// La barra va de 0 % a 250 % de la descarga permitida; los valores mayores quedan en el extremo derecho.
const ESCALA_MEDIDOR = 250;

// Posición (0 a 100 %) de una marca en el medidor horizontal; el medidor llega hasta 250 %.
function posicionMedidor(porcentaje) {
  return Math.min(100, Math.max(0, ((porcentaje ?? ESCALA_MEDIDOR) / ESCALA_MEDIDOR) * 100));
}

// Marcas del medidor para el modelo: sin obra y, si existe, con la obra.
function marcasMedidor(modelo, incluirObra = true) {
  if (!modelo.antes) return [];
  const marcas = [{ tipo: 'antes', etiqueta: 'Sin obra', evaluacion: modelo.antes.evaluacion }];
  const conObra = incluirObra ? (modelo.previa || modelo.despues) : null;
  if (conObra) {
    marcas.push({
      tipo: modelo.previa ? 'previa' : 'despues',
      etiqueta: modelo.previa ? 'Vista previa' : 'Con la obra',
      evaluacion: conObra.evaluacion
    });
  }
  return marcas;
}

// Barra horizontal con los tramos verde, amarillo y rojo del semáforo y una marca por escenario.
function htmlMedidor(marcas, compacto = false) {
  if (marcas.length === 0) return '';
  const finVerde = posicionMedidor(UMBRALES_SEMAFORO.verde * 100);
  const finAmarillo = posicionMedidor(UMBRALES_SEMAFORO.amarillo * 100);
  const descripcion = marcas.map((m) => `${m.etiqueta}: ${m.evaluacion.porcentaje ?? '-'} %`).join(', ');
  return `
    <div class="medidor ${compacto ? 'medidor-compacto' : ''}" role="img" aria-label="Relación con la descarga permitida. ${descripcion}">
      <div class="medidor-pista" style="--fin-verde:${finVerde}%; --fin-amarillo:${finAmarillo}%">
        ${marcas.map((m) => `<span class="medidor-marca marca-${m.tipo}" style="left:${posicionMedidor(m.evaluacion.porcentaje)}%"></span>`).join('')}
      </div>
      <div class="medidor-escala">
        <span style="left:0">0 %</span>
        <span style="left:${finVerde}%">100 %</span>
        <span style="left:${finAmarillo}%">150 %</span>
        <span style="left:100%">${ESCALA_MEDIDOR} %+</span>
      </div>
      <div class="medidor-leyenda">
        ${marcas.map((m) => `<span><i class="marca-${m.tipo}"></i>${m.etiqueta}: <b style="color:${COLORES_SEMAFORO[m.evaluacion.nivel]}">${m.evaluacion.porcentaje ?? '-'} %</b></span>`).join('')}
      </div>
    </div>`;
}

// ---------- Ayudas de la pestaña Cálculo ----------

// Avance de los pasos del cálculo; cada paso lleva a su tarjeta.
function pintarProgreso(p) {
  const pasos = [
    ['paso-coeficiente', 'Coeficiente C', p.coeficiente != null],
    ['paso-intensidad', 'Intensidad', p.intensidad != null],
    ['paso-caudal', 'Caudal pico', p.caudalPico != null],
    ['semaforo-calculo', 'Semáforo', p.caudalPico != null]
  ];
  const siguiente = pasos.findIndex(([, , listo]) => !listo);
  $('progreso-calculo').innerHTML = pasos.map(([destino, texto, listo], i) => `
    <li class="${listo ? 'listo' : ''} ${i === siguiente ? 'siguiente' : ''}">
      <button type="button" data-destino="${destino}">
        <span class="progreso-numero">${listo ? '✓' : i + 1}</span>${texto}
      </button>
    </li>`).join('');
  ['paso-coeficiente', 'paso-intensidad', 'paso-caudal'].forEach((id, i) => {
    $(id).classList.toggle('paso-listo', pasos[i][2]);
  });
}

// Vista previa del coeficiente C mientras se escriben las superficies.
function pintarVistaCoeficiente() {
  const caja = $('vista-coeficiente');
  const p = estado.proyecto;
  const c = estado.coeficientes;
  const sup = validarSuperficies($('ap').value, $('ai').value);
  if (!p || !c || c.Cp == null || c.Ci == null || sup.error) {
    caja.innerHTML = '';
    return;
  }
  const coeficiente = calcularCoeficiente(c.Cp, c.Ci, sup.ap, sup.ai);
  const impermeable = (sup.ai / sup.total) * 100;
  const sinGuardar = sup.ap !== p.superficiePermeable || sup.ai !== p.superficieImpermeable;
  caja.innerHTML = `
    <div class="composicion">
      <div class="composicion-barra" role="img" aria-label="Impermeable ${Math.round(impermeable)} %">
        <i class="parte-permeable" style="width:${100 - impermeable}%"></i>
        <i class="parte-impermeable" style="width:${impermeable}%"></i>
      </div>
      <div class="composicion-texto">
        <span><i class="parte-permeable"></i>Permeable ${Math.round(100 - impermeable)} % · Cp ${numero(c.Cp, 2)}</span>
        <span><i class="parte-impermeable"></i>Impermeable ${Math.round(impermeable)} % · Ci ${numero(c.Ci, 2)}</span>
      </div>
      <div class="desarrollo">
        C = (${numero(c.Cp, 2)} × ${numeroCorto(sup.ap)} + ${numero(c.Ci, 2)} × ${numeroCorto(sup.ai)}) / ${numeroCorto(sup.total)}
        = <b>${numero(coeficiente, 2)}</b>
        ${sinGuardar ? '<span class="etiqueta-mini">sin guardar</span>' : ''}
      </div>
    </div>`;
}

// Intensidades de la alcaldía del proyecto (se consultan una vez por alcaldía).
async function cargarIntensidades(idAlcaldia) {
  if (estado.intensidades.idAlcaldia === idAlcaldia) return;
  estado.intensidades = { idAlcaldia, valores: null };
  const valores = await obtenerIntensidadesAlcaldia(idAlcaldia);
  if (estado.intensidades.idAlcaldia !== idAlcaldia) return;
  estado.intensidades.valores = valores;
  if (estado.proyecto) pintarGraficaIntensidad(estado.proyecto);
}

// Gráfica de barras con la intensidad de cada período de retorno
function pintarGraficaIntensidad(p) {
  const caja = $('grafica-intensidad');
  const valores = estado.intensidades.idAlcaldia === p.idAlcaldia ? estado.intensidades.valores : null;
  if (!valores) {
    caja.innerHTML = '';
    cargarIntensidades(p.idAlcaldia);
    return;
  }
  const elegido = Number($('periodo').value);
  const maximo = Math.max(1, ...PERIODOS_RETORNO.map((t) => valores[t] || 0));
  caja.innerHTML = `
    <div class="grafica-intensidad">
      <div class="grafica-titulo">Intensidad normativa de ${escapar(p.alcaldia)} (mm/h)</div>
      <div class="grafica-barras">
        ${PERIODOS_RETORNO.map((t) => {
          const valor = valores[t];
          const alto = valor == null ? 6 : Math.max(8, (valor / maximo) * 100);
          return `
          <button type="button" class="barra-periodo ${t === elegido ? 'elegida' : ''} ${valor == null ? 'sin-dato' : ''}"
            data-periodo="${t}" aria-label="${t} años: ${valor == null ? 'sin dato' : `${numeroCorto(valor)} mm/h`}">
            <span class="barra-valor">${valor == null ? 's/d' : numeroCorto(valor, 1)}</span>
            <span class="barra-columna"><span class="barra" style="height:${alto}%"></span></span>
            <span class="barra-texto">${t} años</span>
          </button>`;
        }).join('')}
      </div>
      <span class="ayuda">Haga clic en una barra para elegir el período de retorno.</span>
    </div>`;
}

// Fórmula del caudal pico con los valores del proyecto sustituidos.
function pintarDesarrolloCaudal(p, permitido) {
  const caja = $('desarrollo-caudal');
  const faltantes = [];
  if (p.coeficiente == null) faltantes.push('coeficiente C (paso 01)');
  if (p.intensidad == null) faltantes.push('intensidad de lluvia (paso 02)');
  if (faltantes.length > 0) {
    caja.innerHTML = `<div class="desarrollo desarrollo-pendiente">Falta: ${faltantes.join(' y ')}.</div>`;
    return;
  }
  const hectareas = p.superficieTotal / 10000;
  const caudal = calcularCaudalPico(p.coeficiente, p.intensidad, p.superficieTotal);
  caja.innerHTML = `
    <div class="desarrollo">
      Q = ${numero(p.coeficiente, 2)} × ${numeroCorto(p.intensidad)} mm/h × ${numeroCorto(hectareas, 4)} ha / 360
      = <b>${numero(caudal, 3)} m³/s</b>
      ${p.caudalPico == null ? '<span class="etiqueta-mini">sin guardar</span>' : ''}
      <span class="desarrollo-nota">Equivale a ${numero(caudal * 1000, 0)} L/s
        ${permitido != null ? ` · el terreno sin construir desalojaría ${numero(permitido * 1000, 0)} L/s` : ''}.</span>
    </div>`;
}

function botonUsarCapacidad(capacidad) {
  return capacidad <= 50000
    ? `<button type="button" class="boton boton-contorno boton-chico usar-capacidad" data-capacidad="${capacidad}">Usar</button>`
    : '';
}

// Recomienda la capacidad de obra necesaria para bajar a amarillo y a verde.
function pintarRecomendacion(p, modelo) {
  const caja = $('recomendacion-mitigacion');
  if (!modelo.antes) {
    caja.innerHTML = '';
    return;
  }
  if (modelo.antes.evaluacion.nivel === 'verde') {
    caja.innerHTML = `<div class="recomendacion"><h3>Recomendación</h3>
      El proyecto ya está en riesgo bajo sin obra de mitigación; una obra adicional es opcional.</div>`;
    return;
  }
  // La capacidad se calcula con la eficiencia de la ubicación elegida (100 % si aún no hay obra en el mapa).
  const eficiencia = estado.obra ? estado.obra.eficiencia : 1;
  const limites = limitesSemaforo(modelo.permitido);
  const paraVerde = capacidadNecesaria(p.caudalPico, limites.verde, eficiencia);
  const paraAmarillo = capacidadNecesaria(p.caudalPico, limites.amarillo, eficiencia);
  const fueraDeRango = paraVerde > 50000
    ? '<span class="ayuda">La capacidad para riesgo bajo supera el máximo de una obra (50,000 m³): conviene reducir la superficie impermeable.</span>'
    : '';
  const ubicacion = estado.obra
    ? `en la ubicación elegida (a ${numero(estado.obra.distancia, 1)} m, eficiencia ${Math.round(eficiencia * 100)} %)`
    : 'junto al proyecto (eficiencia 100 %); al colocar la obra en el mapa se ajusta a su eficiencia';
  caja.innerHTML = `<div class="recomendacion"><h3>¿Cómo reaccionar ante el encharcamiento?</h3>
    <ul class="lista-recomendacion">
      ${modelo.antes.evaluacion.nivel === 'rojo' ? `<li><span>Para bajar a <b>riesgo medio</b>: <b>${numero(paraAmarillo, 2)} m³</b></span>${botonUsarCapacidad(paraAmarillo)}</li>` : ''}
      <li><span>Para llegar a <b>riesgo bajo</b>: <b>${numero(paraVerde, 2)} m³</b></span>${botonUsarCapacidad(paraVerde)}</li>
    </ul>
    <span class="ayuda">Capacidad = (Qpico − Qobjetivo) × 3,600 s / eficiencia, con la obra ${ubicacion}.</span>${fueraDeRango}</div>`;
}
