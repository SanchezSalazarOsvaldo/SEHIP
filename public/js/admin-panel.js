// el mapa general separa en capas las incidencias, los reportes por validar, las obras y los proyectos, y el administrador las prende o apaga.
// Si usaramos solo un grupo de marcadores con cientos de puntos el mapa sería ilegible.
// Panel del Administrador del Sistema: panel de control (RF-ADM-02), tabla maestra (RF-ADM-03) y
// gestión de usuarios (RF-ADM-04 a RF-ADM-07). Las peticiones al servidor están en js/administracion.js;
// aquí se dibuja la pantalla con sus respuestas y se atienden los clics.

// Datos que necesita la pantalla del administrador en este momento.
const estadoAdmin = {
  usuario: null,
  tabla: null,          // tabla maestra vigente
  filtro: null,         // texto de búsqueda aplicado en la lista de usuarios
  mapa: null,
  controlCapas: null,   // selector de capas del mapa general
  capasDatos: []        // capas de incidencias, proyectos y obras dibujadas en el mapa
};

// Colores del mapa general: los mismos del semáforo y de la obra de mitigación del simulador.
const COLORES_MAPA_ADMIN = {
  verde: '#3F6B22',
  amarillo: '#E0A800',
  rojo: '#C62828',
  enProceso: '#4A6272',
  obra: '#6A1B9A'
};

// Atajo para buscar un elemento de la página por su id.
const $ = (id) => document.getElementById(id); // Se usa en lugar de document.querySelector('#id') porque es más rápido y más corto. Se usa solo para id, no para selectores complejos.

// ---------- Utilidades ----------

// Convierte un texto en HTML seguro, para que un nombre o una descripción no puedan inyectar código.
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Número con separador de miles y los decimales indicados.
function numero(valor, decimales) { // Esta funcion devuelve un string con el número formateado con separador de miles y los decimales indicados. Si el valor es null o undefined devuelve null.
    // Se usa para mostrar los números en la pantalla del administrador, por ejemplo el caudal pico de un proyecto o el total de incidencias.
  if (valor === null || valor === undefined) return null;
  return Number(valor).toLocaleString('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
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

// Aviso breve en la parte inferior de la pantalla que desaparece solo.
let temporizadorSnackbar;
function snackbar(texto) {
  const caja = $('snackbar');
  caja.querySelector('span').textContent = texto;
  caja.classList.remove('oculto');
  clearTimeout(temporizadorSnackbar);
  temporizadorSnackbar = setTimeout(() => caja.classList.add('oculto'), 4000);
}

// Muestra la pantalla de acceso denegado cuando una operación responde que no hay rol de administrador.
function revisarAcceso(resultado) {
  if (resultado.estado === 'sin-sesion') {
    window.location.href = 'admin.html';
    return false;
  }
  if (resultado.estado === 'cambio-obligatorio') {
    window.location.href = 'contrasena.html';
    return false;
  }
  if (!resultado.ok && resultado.error === MENSAJES.accesoDenegado) {
    mostrarAccesoDenegado();
    return false;
  }
  return true;
}

// Oculta el panel y muestra el aviso de acceso denegado (para una 
// cuenta que no es de administrador).
function mostrarAccesoDenegado() {
  $('contenido-admin').classList.add('oculto');
  $('acceso-denegado').classList.remove('oculto');
  $('texto-denegado').textContent = MENSAJES.accesoDenegado;
}

// ---------- Pestañas ----------

// Cambia de pestaña: marca el botón activo y muestra solo su contenido.
function mostrarPestana(nombre) {
  document.querySelectorAll('.pestana').forEach((b) => b.classList.toggle('activa', b.dataset.pestana === nombre));
  document.querySelectorAll('.panel-pestana').forEach((p) => p.classList.toggle('oculto', p.id !== `pestana-${nombre}`));
  if (nombre === 'panel') cargarPanel();
  if (nombre === 'tabla') cargarTabla();
  if (nombre === 'usuarios') cargarUsuarios(estadoAdmin.filtro);
}

// ---------- RF-ADM-02: panel de control ----------

// Crea el mapa general con los contornos de las alcaldías y el selector de capas.
function iniciarMapaIncidencias() {
  const mapa = L.map('mapa-incidencias', { minZoom: 9, maxZoom: 18 });
  const capas = {};
  PROVEEDORES_MAPA.forEach((p) => { capas[p.nombre] = L.tileLayer(p.url, p.opciones); });
  capas[PROVEEDORES_MAPA[0].nombre].addTo(mapa);
  estadoAdmin.controlCapas = L.control.layers(capas, null, { position: 'bottomright', collapsed: false }).addTo(mapa);
  const limites = L.geoJSON(LIMITES_ALCALDIAS);
  mapa.fitBounds(limites.getBounds());
  estadoAdmin.mapa = mapa;
}

// Marcador cuadrado para un proyecto y en forma de rombo para una obra de mitigación.
function iconoMarca(clase, color, opacidad = 1) {
  return L.divIcon({
    className: '',
    html: `<span class="${clase}" style="background:${color};opacity:${opacidad}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

// Capa de proyectos: un cuadro por proyecto con el color de su semáforo (gris si aún no tiene caudal).
// Devuelve también el caudal permitido de cada proyecto para saber si sus simulaciones siguen vigentes.
function capaProyectos(proyectos, simulaciones, cp) {
  const grupo = L.layerGroup();
  const permitidos = {};
  proyectos.forEach((p) => {
    const permitido = cp != null && p.intensidad != null && p.superficieTotal != null
      ? calcularCaudalPico(cp, p.intensidad, p.superficieTotal) : null;
    permitidos[p.id] = permitido;
    const semaforo = p.caudalPico != null && permitido != null ? evaluarSemaforo(p.caudalPico, permitido) : null;
    const color = semaforo ? COLORES_MAPA_ADMIN[semaforo.nivel] : COLORES_MAPA_ADMIN.enProceso;
    const total = simulaciones.filter((s) => s.idProyecto === p.id).length;
    L.marker([p.latitud, p.longitud], { icon: iconoMarca('marca-proyecto', color) })
      .bindPopup(`<strong>#${p.id} · ${escapar(p.nombre)}</strong><br>
        Ingeniero: ${escapar(p.ingeniero)}<br>
        Alcaldía: ${escapar(p.alcaldia)} · ${escapar(p.estado)}<br>
        ${p.caudalPico != null ? `Caudal pico: ${numero(p.caudalPico, 3)} m³/s` : 'Caudal pico: sin calcular'}
        ${semaforo ? `<br>Semáforo: <b style="color:${color}">${semaforo.etiqueta} · ${Math.round(semaforo.porcentaje)} %</b>` : ''}
        <br>Simulaciones: ${total}`)
      // Al seleccionar un proyecto el mapa se acerca a él, para ver sus obras de mitigación por separado.
      .on('click', () => estadoAdmin.mapa.setView([p.latitud, p.longitud], Math.max(estadoAdmin.mapa.getZoom(), 16)))
      .addTo(grupo);
  });
  return { grupo, permitidos };
}

// Capa de obras: un rombo por simulación unido con línea punteada a su proyecto. Las simulaciones que ya
// no corresponden a los datos actuales del proyecto se ven tenues.
function capaObras(proyectos, simulaciones, permitidos) {
  const grupo = L.layerGroup();
  simulaciones.forEach((s) => {
    const p = proyectos.find((x) => x.id === s.idProyecto);
    if (!p) return;
    const vigente = simulacionVigente(s, p, permitidos[p.id]);
    // Sin eficiencia: la obra quedó fuera de la zona afectada actual o el proyecto no tiene caudal pico.
    const resultado = s.eficiencia == null
      ? 'Sin resultado: la obra quedó fuera de la zona afectada actual del proyecto'
      : `Eficiencia: ${Math.round(s.eficiencia * 100)} %<br>Caudal ajustado: ${numero(s.caudalAjustado, 3)} m³/s `
        + `(${evaluarSemaforo(s.caudalAjustado, s.caudalPermitido).etiqueta})`;
    L.polyline([[p.latitud, p.longitud], [s.latitud, s.longitud]], {
      color: COLORES_MAPA_ADMIN.obra, weight: 1.5, dashArray: '4 4', opacity: vigente ? 0.8 : 0.35
    }).addTo(grupo);
    L.marker([s.latitud, s.longitud], { icon: iconoMarca('marca-obra', COLORES_MAPA_ADMIN.obra, vigente ? 1 : 0.45) })
      .bindPopup(`<strong>${escapar(s.tipoObra)}</strong><br>
        Proyecto #${p.id} · ${escapar(p.nombre)}<br>
        Capacidad: ${numero(s.capacidad, 2)} m³<br>
        ${resultado}<br>
        ${escapar(s.fechaHora)} · ${vigente ? 'Vigente' : 'Desactualizada'}`)
      .addTo(grupo);
  });
  return grupo;
}

// Datos de una incidencia para su ventana en el mapa: alcaldía, fecha, nivel del agua y descripción.
// Explicación de cada nivel del agua tal como lo elige el ciudadano en la app.
const TEXTO_NIVEL = { Bajo: 'hasta el tobillo', Medio: 'hasta la rodilla', Alto: 'arriba de la rodilla' };
function detalleIncidencia(i) {
  return `${escapar(i.alcaldia)} · ${escapar(i.fechaRegistro)}<br>
    ${i.nivelAgua ? `Nivel del agua: ${escapar(i.nivelAgua)} (${TEXTO_NIVEL[i.nivelAgua] || ''})<br>` : ''}
    ${i.descripcion ? `“${escapar(i.descripcion)}”<br>` : ''}
    ${numero(i.latitud, 6)}, ${numero(i.longitud, 6)}<br>`;
}

// RF-ADM-02: pide los datos del panel, escribe los totales y dibuja las capas del mapa general.
async function cargarPanel() {
  const datos = await obtenerPanelControl();
  if (!revisarAcceso(datos)) return;
  if (!datos.ok) {
    mostrarMensaje('msg-panel', 'error', datos.error);
    return;
  }
  $('total-proyectos').textContent = numero(datos.totalProyectos, 0);
  $('total-simulaciones').textContent = numero(datos.totalSimulaciones, 0);
  // Las incidencias aprobadas son las que cuentan y se muestran como puntos críticos; los reportes de
  // ciudadanos pendientes de validar se muestran aparte para que el administrador los apruebe o elimine.
  const aprobadas = datos.incidencias.filter((i) => i.estado !== 'Pendiente');
  const pendientes = datos.incidencias.filter((i) => i.estado === 'Pendiente');
  $('total-incidencias').textContent = numero(aprobadas.length, 0);
  $('pendientes-incidencias').textContent = pendientes.length === 0 ? ''
    : `${pendientes.length} reporte${pendientes.length === 1 ? '' : 's'} ciudadano${pendientes.length === 1 ? '' : 's'} por validar`;
  $('fecha-consulta').textContent = `Acumulado al ${datos.fechaConsulta}`;
  $('msg-panel').innerHTML = '';
  if (aprobadas.length === 0) mostrarMensaje('msg-panel', 'info', MENSAJES.sinIncidencias);

  if (!estadoAdmin.mapa) iniciarMapaIncidencias();
  estadoAdmin.capasDatos.forEach((capa) => {
    estadoAdmin.mapa.removeLayer(capa);
    estadoAdmin.controlCapas.removeLayer(capa);
  });

  // Alcaldías con tono según su número de incidencias y un marcador por punto crítico.
  const porAlcaldia = {};
  aprobadas.forEach((i) => { porAlcaldia[i.alcaldia] = (porAlcaldia[i.alcaldia] || 0) + 1; });
  const maximo = Math.max(1, ...Object.values(porAlcaldia));
  const grupo = L.layerGroup();
  L.geoJSON(LIMITES_ALCALDIAS, {
    style: (f) => {
      const n = porAlcaldia[f.properties.nombre] || 0;
      return { color: '#006B78', weight: 1.2, fillColor: '#006B78', fillOpacity: 0.04 + 0.3 * (n / maximo) };
    },
    onEachFeature: (f, capa) => {
      const n = porAlcaldia[f.properties.nombre] || 0;
      capa.bindTooltip(`${f.properties.nombre}: ${n} incidencia${n === 1 ? '' : 's'}`, { sticky: true, className: 'etiqueta-mapa' });
    }
  }).addTo(grupo);
  // Al hacer clic en una incidencia se abre su detalle con el botón para eliminarla (por ejemplo, si
  // el reporte resultó falso).
  aprobadas.forEach((i) => {
    L.circleMarker([i.latitud, i.longitud], {
      radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#C62828', fillOpacity: 1
    }).bindTooltip(`<strong>${escapar(i.alcaldia)}</strong><br>${escapar(i.fechaRegistro)}`, { className: 'etiqueta-mapa' })
      .bindPopup(`<strong>${escapar(i.tipo || 'Punto crítico de encharcamiento')}</strong>
        ${i.origen === 'Ciudadano' ? '<span class="etiqueta-mini">Reporte ciudadano</span>' : ''}<br>
        ${detalleIncidencia(i)}
        <button type="button" class="boton boton-peligro boton-chico boton-incidencia" data-id="${i.id}">Eliminar incidencia</button>`)
      .addTo(grupo);
  });
  const grupoPendientes = L.layerGroup();
  pendientes.forEach((i) => {
    L.circleMarker([i.latitud, i.longitud], {
      radius: 7, color: '#C62828', weight: 2.5, fillColor: '#FFFFFF', fillOpacity: 1, dashArray: '3 2'
    }).bindPopup(`<strong>Reporte ciudadano por validar</strong><br>
        <b>${escapar(i.tipo)}</b><br>
        ${detalleIncidencia(i)}
        <div class="acciones-cuenta">
          <button type="button" class="boton boton-contorno boton-chico boton-aprobar" data-id="${i.id}">Aprobar</button>
          <button type="button" class="boton boton-peligro boton-chico boton-incidencia" data-id="${i.id}">Eliminar incidencia</button>
        </div>`)
      .addTo(grupoPendientes);
  });

  // Proyectos y obras de mitigación de todos los ingenieros; cada capa se puede ocultar desde el selector.
  const { grupo: proyectos, permitidos } = capaProyectos(datos.proyectos, datos.simulaciones, datos.coeficientePermeable);
  const obras = capaObras(datos.proyectos, datos.simulaciones, permitidos);
  [[grupo, 'Incidencias'], [grupoPendientes, 'Reportes por validar'], [obras, 'Obras de mitigación'],
    [proyectos, 'Proyectos']].forEach(([capa, nombre]) => {
    capa.addTo(estadoAdmin.mapa);
    estadoAdmin.controlCapas.addOverlay(capa, nombre);
  });
  estadoAdmin.capasDatos = [grupo, grupoPendientes, obras, proyectos];
  setTimeout(() => estadoAdmin.mapa.invalidateSize(), 50);
}
