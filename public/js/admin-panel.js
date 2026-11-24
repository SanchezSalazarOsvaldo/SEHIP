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

// SEGUNDO COMMIT DEL ARCHIVO cada cuenta muestra solo los botones permitidos (el administrador inicial y la cuenta propia no ofrecen acciones prohibidas).
// la interfaz solo es comodidad; la regla real está en admin.js y en los triggers.
// ---------- RF-ADM-03: tabla maestra ----------

// Valor vigente del parámetro elegido en el formulario (Cp, Ci o una intensidad).
function valorParametroSeleccionado() {
  const t = estadoAdmin.tabla;
  const tipo = $('tipo-parametro').value;
  if (tipo !== 'intensidad') return t.coeficientes[tipo];
  const fila = t.intensidades.find((f) => String(f.idAlcaldia) === $('parametro-alcaldia').value);
  return fila ? fila.valores[$('parametro-periodo').value] : null;
}

// Actualiza el formulario según el parámetro elegido (campos visibles, valor vigente y rango).
function pintarParametroSeleccionado() {
  const esIntensidad = $('tipo-parametro').value === 'intensidad';
  $('campos-intensidad').classList.toggle('oculto', !esIntensidad);
  const valor = valorParametroSeleccionado();
  $('valor-vigente').textContent = valor == null
    ? 'Sin capturar'
    : `${numero(valor, 2)}${esIntensidad ? ' mm/h' : ''}`;
  $('rango-parametro').textContent = esIntensidad
    ? 'Rango normativo: 10.00 a 250.00 mm/h, hasta dos decimales.'
    : 'Rango normativo: 0.05 a 0.95, hasta dos decimales.';
  document.querySelectorAll('.celda-intensidad').forEach((c) => {
    c.classList.toggle('seleccionada', esIntensidad
      && c.dataset.alcaldia === $('parametro-alcaldia').value && c.dataset.periodo === $('parametro-periodo').value);
  });
  document.querySelectorAll('.metrica-boton').forEach((b) => {
    b.classList.toggle('seleccionada', b.dataset.tipo === $('tipo-parametro').value);
  });
}

// Dibuja Cp, Ci y la tabla de intensidades; las celdas sin valor muestran 'Sin capturar'.
function pintarTabla(tabla) {
  estadoAdmin.tabla = tabla;
  $('valor-cp').textContent = tabla.coeficientes.Cp == null ? 'Sin capturar' : numero(tabla.coeficientes.Cp, 2);
  $('valor-ci').textContent = tabla.coeficientes.Ci == null ? 'Sin capturar' : numero(tabla.coeficientes.Ci, 2);
  const select = $('parametro-alcaldia');
  if (select.options.length === 0) {
    tabla.intensidades.forEach((f) => select.add(new Option(f.alcaldia, f.idAlcaldia)));
  }
  $('tabla-intensidades').innerHTML = tabla.intensidades.map((f) => `
    <tr>
      <td>${escapar(f.alcaldia)}</td>
      ${PERIODOS_RETORNO.map((p) => {
        const v = f.valores[p];
        return `<td class="num"><button type="button" class="celda-intensidad ${v == null ? 'sin-valor' : ''}"
          data-alcaldia="${f.idAlcaldia}" data-periodo="${p}">${v == null ? 'Sin capturar' : numero(v, 2)}</button></td>`;
      }).join('')}
    </tr>`).join('');
  pintarParametroSeleccionado();
}

// Pide la tabla maestra al servidor y la dibuja.
async function cargarTabla() {
  const tabla = await obtenerTablaMaestra();
  if (!revisarAcceso(tabla)) return;
  if (tabla.ok) pintarTabla(tabla);
}

// ---------- RF-ADM-04 a RF-ADM-07: usuarios ----------

// Dibuja la tabla de cuentas con los botones permitidos para cada una (cambiar rol, desactivar,
// reactivar o eliminar); el administrador inicial y la cuenta propia no ofrecen las acciones prohibidas.
function pintarUsuarios(usuarios) {
  $('conteo-usuarios').textContent = `${usuarios.length} cuenta${usuarios.length === 1 ? '' : 's'}`;
  if (usuarios.length === 0) {
    $('tabla-usuarios').innerHTML = '<tr><td colspan="5" class="tabla-vacia">Sin resultados</td></tr>';
    return;
  }
  $('tabla-usuarios').innerHTML = usuarios.map((u) => `
    <tr class="${u.activo ? '' : 'fila-inactiva'}">
      <td>
        <div class="usuario-celda">${escapar(u.nombre)}
          ${u.propio ? '<span class="etiqueta-mini">Tú</span>' : ''}
          ${u.protegido ? '<span class="etiqueta-mini etiqueta-inicial">Administrador inicial</span>' : ''}
        </div>
      </td>
      <td>${escapar(u.correo)}</td>
      <td>
        <div class="control-rol">
          <select class="select-rol" data-id="${u.id}" aria-label="Rol de ${escapar(u.nombre)}">
            ${ROLES.map((r) => `<option ${r === u.rol ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <button type="button" class="boton boton-contorno boton-chico" data-accion="rol" data-id="${u.id}">Guardar rol</button>
        </div>
      </td>
      <td><span class="chip ${u.activo ? 'chip-calculado' : 'chip-inactivo'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        ${u.activo
          ? `<button type="button" class="boton boton-peligro boton-chico" data-accion="desactivar" data-id="${u.id}">
              Desactivar cuenta
            </button>`
          : `<div class="acciones-cuenta">
              <button type="button" class="boton boton-contorno boton-chico" data-accion="reactivar" data-id="${u.id}">
                Reactivar cuenta
              </button>
              ${u.protegido || u.propio ? '' : `<button type="button" class="boton boton-peligro boton-chico" data-accion="eliminar" data-id="${u.id}">
                Eliminar cuenta
              </button>`}
            </div>`}
      </td>
    </tr>`).join('');
}

// texto null muestra todas las cuentas; con texto aplica la búsqueda de RF-ADM-05.
async function cargarUsuarios(texto = null) {
  const resultado = await buscarUsuarios(texto);
  if (!revisarAcceso(resultado)) return;
  $('msg-usuarios').innerHTML = '';
  if (!resultado.ok) {
    mostrarMensaje('msg-usuarios', 'error', resultado.error);
    if (resultado.usuarios) pintarUsuarios(resultado.usuarios);
    return;
  }
  estadoAdmin.filtro = texto;
  pintarUsuarios(resultado.usuarios);
}

// Después de una operación se conserva el filtro aplicado (si sigue habiendo coincidencias).
async function refrescarUsuarios() {
  if (estadoAdmin.filtro) {
    const filtrados = await buscarUsuarios(estadoAdmin.filtro);
    if (filtrados.ok) {
      pintarUsuarios(filtrados.usuarios);
      return;
    }
  }
  estadoAdmin.filtro = null;
  $('texto-buscar').value = '';
  pintarUsuarios((await buscarUsuarios()).usuarios);
}

// ---------- Eventos ----------

// Botones de las pestañas.
document.querySelectorAll('.pestana').forEach((b) => b.addEventListener('click', () => mostrarPestana(b.dataset.pestana)));

// Al cambiar el parámetro, la alcaldía o el período se muestra su valor vigente.
$('tipo-parametro').addEventListener('change', pintarParametroSeleccionado);
$('parametro-alcaldia').addEventListener('change', pintarParametroSeleccionado);
$('parametro-periodo').addEventListener('change', pintarParametroSeleccionado);

// Clic en un valor de la tabla: lo selecciona para editarlo.
$('tabla-intensidades').addEventListener('click', (evento) => {
  const celda = evento.target.closest('.celda-intensidad');
  if (!celda) return;
  $('tipo-parametro').value = 'intensidad';
  $('parametro-alcaldia').value = celda.dataset.alcaldia;
  $('parametro-periodo').value = celda.dataset.periodo;
  $('msg-parametro').innerHTML = '';
  pintarParametroSeleccionado();
  $('valor-parametro').focus();
});
// Clic en Cp o Ci: lo selecciona para editarlo.
document.querySelectorAll('.metrica-boton').forEach((b) => b.addEventListener('click', () => {
  $('tipo-parametro').value = b.dataset.tipo;
  $('msg-parametro').innerHTML = '';
  pintarParametroSeleccionado();
  $('valor-parametro').focus();
}));

// RF-ADM-03: actualizar parámetro.
$('form-parametro').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const resultado = await actualizarParametro({
    tipo: $('tipo-parametro').value,
    idAlcaldia: $('parametro-alcaldia').value,
    periodo: $('parametro-periodo').value,
    valor: $('valor-parametro').value
  });
  if (!revisarAcceso(resultado)) return;
  if (!resultado.ok) {
    mostrarMensaje('msg-parametro', 'error', resultado.error);
    return;
  }
  $('valor-parametro').value = '';
  pintarTabla(resultado);
  mostrarMensaje('msg-parametro', 'exito', resultado.mensaje);
});

// RF-ADM-04: crear cuenta.
$('form-cuenta').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = evento.target.querySelector('button');
  boton.disabled = true;
  const resultado = await crearCuenta($('cuenta-nombre').value, $('cuenta-correo').value, $('cuenta-rol').value);
  boton.disabled = false;
  if (!revisarAcceso(resultado)) return;
  if (!resultado.ok) {
    mostrarMensaje('msg-cuenta', 'error', resultado.error);
    return;
  }
  evento.target.reset();
  mostrarMensaje('msg-cuenta', 'exito', resultado.mensaje);
  await refrescarUsuarios();
});

// RF-ADM-05: filtrar usuarios.
$('form-buscar').addEventListener('submit', (evento) => {
  evento.preventDefault();
  cargarUsuarios($('texto-buscar').value.trim());
});
// Quita el filtro y vuelve a mostrar todas las cuentas.
$('boton-todos').addEventListener('click', () => {
  $('texto-buscar').value = '';
  cargarUsuarios(null);
});

// RF-ADM-06, RF-ADM-07 y eliminación: acciones de cada fila.
const TEXTOS_CONFIRMACION = {
  desactivar: { normal: 'Desactivar cuenta', confirmar: 'Confirmar desactivación' },
  eliminar: { normal: 'Eliminar cuenta', confirmar: 'Confirmar eliminación' }
};
// Temporizador que cancela la confirmación pendiente a los 4 segundos.
let temporizadorConfirmacion;
$('tabla-usuarios').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.dataset.id);

  if (boton.dataset.accion === 'rol') {
    const rol = document.querySelector(`.select-rol[data-id="${id}"]`).value;
    const resultado = await modificarRol(id, rol);
    if (!revisarAcceso(resultado)) return;
    if (!resultado.ok) {
      mostrarMensaje('msg-usuarios', 'error', resultado.error);
      await refrescarUsuarios();
      return;
    }
    mostrarMensaje('msg-usuarios', 'exito', resultado.mensaje);
    await refrescarUsuarios();
    return;
  }

  // Reactivar no pide confirmación: devuelve la cuenta a su estado anterior.
  if (boton.dataset.accion === 'reactivar') {
    const resultado = await reactivarCuenta(id);
    if (!revisarAcceso(resultado)) return;
    mostrarMensaje('msg-usuarios', resultado.ok ? 'exito' : 'error', resultado.ok ? resultado.mensaje : resultado.error);
    if (resultado.ok) snackbar(resultado.mensaje);
    await refrescarUsuarios();
    return;
  }

  // Desactivar y eliminar piden una segunda pulsación para confirmar: desactivar deja a la persona sin
  // acceso y eliminar borra la cuenta con todo su historial de forma definitiva.
  const textos = TEXTOS_CONFIRMACION[boton.dataset.accion];
  if (!boton.classList.contains('confirmando')) {
    document.querySelectorAll('.confirmando').forEach((b) => {
      b.classList.remove('confirmando');
      b.textContent = TEXTOS_CONFIRMACION[b.dataset.accion].normal;
    });
    boton.classList.add('confirmando');
    boton.textContent = textos.confirmar;
    clearTimeout(temporizadorConfirmacion);
    temporizadorConfirmacion = setTimeout(() => {
      boton.classList.remove('confirmando');
      boton.textContent = textos.normal;
    }, 4000);
    return;
  }
  const resultado = boton.dataset.accion === 'eliminar' ? await eliminarCuenta(id) : await desactivarCuenta(id);
  if (!revisarAcceso(resultado)) return;
  if (!resultado.ok) {
    mostrarMensaje('msg-usuarios', 'error', resultado.error);
    await refrescarUsuarios();
    return;
  }
  mostrarMensaje('msg-usuarios', 'exito', resultado.mensaje);
  snackbar(resultado.mensaje);
  await refrescarUsuarios();
});

// Eliminar una incidencia desde su ventana en el mapa: el primer clic pide confirmación (4 s).
// Se escucha en fase de captura (true) porque Leaflet detiene la propagación de los clics dentro de
// sus ventanas emergentes.
let temporizadorIncidencia;
$('mapa-incidencias').addEventListener('click', async (evento) => {
  // Aprobar un reporte ciudadano no pide confirmación: se puede eliminar después si hace falta.
  const aprobar = evento.target.closest('.boton-aprobar');
  if (aprobar) {
    aprobar.disabled = true;
    const resultado = await aprobarIncidencia(aprobar.dataset.id);
    if (!revisarAcceso(resultado)) return;
    estadoAdmin.mapa.closePopup();
    if (!resultado.ok) mostrarMensaje('msg-panel', 'error', resultado.error);
    else snackbar(resultado.mensaje);
    await cargarPanel();
    return;
  }
  const boton = evento.target.closest('.boton-incidencia');
  if (!boton) return;
  if (!boton.classList.contains('confirmando')) {
    boton.classList.add('confirmando');
    boton.textContent = 'Confirmar eliminación';
    clearTimeout(temporizadorIncidencia);
    temporizadorIncidencia = setTimeout(() => {
      boton.classList.remove('confirmando');
      boton.textContent = 'Eliminar incidencia';
    }, 4000);
    return;
  }
  clearTimeout(temporizadorIncidencia);
  boton.disabled = true;
  const resultado = await eliminarIncidencia(boton.dataset.id);
  if (!revisarAcceso(resultado)) return;
  estadoAdmin.mapa.closePopup();
  if (!resultado.ok) {
    mostrarMensaje('msg-panel', 'error', resultado.error);
    return;
  }
  snackbar(resultado.mensaje);
  await cargarPanel();
}, true);

// RF-ADM-13: cerrar sesión.
$('boton-salir').addEventListener('click', async () => {
  await cerrarSesionAdmin();
  window.location.href = 'admin.html';
});

// ---------- Inicio ----------

async function iniciarAdmin() {
  const sesion = await sesionAdministrador();
  if (sesion.estado === 'sin-sesion') {
    window.location.href = 'admin.html';
    return;
  }
  if (sesion.estado === 'denegado') {
    $('nombre-usuario').textContent = sesion.usuario.nombre;
    mostrarAccesoDenegado();
    return;
  }
  if (sesion.usuario.debeCambiarContrasena) {
    window.location.href = 'contrasena.html';
    return;
  }
  estadoAdmin.usuario = sesion.usuario;
  $('nombre-usuario').textContent = sesion.usuario.nombre;
  $('contenido-admin').classList.remove('oculto');
  mostrarPestana('panel');
}

iniciarAdmin();

