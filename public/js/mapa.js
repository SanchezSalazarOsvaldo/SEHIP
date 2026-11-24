// Dibuja proyectos y obras en el mapa.
const COLORES_SEMAFORO = {
  verde: '#3F6B22',
  amarillo: '#E0A800',
  rojo: '#C62828',
  ninguno: '#006B78',
  nuevo: '#0B3954'
};

const COLOR_OBRA = '#6A1B9A';


const ICONOS_OBRA = {
  'Pozo de Infiltración': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  'Tanque de Tormenta': '<ellipse cx="12" cy="6.5" rx="6.5" ry="2.5"/><path d="M5.5 6.5v11c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-11"/>',
  'Jardín de Lluvia': '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>'
};



const estadoMapa = {
  mapa: null,
  capas: {},          
  resaltada: null,    
  pin: null,          
  predio: null,       
  zonaAntes: null,    
  zonaActual: null,   
  obra: null,         
  linea: null,        
  panel: null,        
  guia: null,         
  guiaZona: null,     
  cursor: null,       
  limites: null,      
  capaBase: null,
  alArrastrarPin: null
};





// Convierte texto en contenido seguro.
function escaparMapa(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}


// Retira una capa del mapa.
function quitarCapa(nombre) {
  if (estadoMapa[nombre]) {
    estadoMapa.mapa.removeLayer(estadoMapa[nombre]);
    estadoMapa[nombre] = null;
  }
}


// Cambia el tamaño de un circulo poco a poco.
function animarRadio(circulo, radioFinal) {
  const radioInicial = circulo.getRadius();
  if (Math.abs(radioInicial - radioFinal) < 0.1) return;
  const inicio = performance.now();
  const duracion = 500;
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - inicio) / duracion);
    const suave = 1 - (1 - t) ** 3;
    circulo.setRadius(radioInicial + (radioFinal - radioInicial) * suave);
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}


// Dibuja o actualiza un circulo del mapa.
function circuloSimulacion(nombre, centro, radio, estilo) {
  if (!radio) {
    quitarCapa(nombre);
    return;
  }
  if (!estadoMapa[nombre]) {
    estadoMapa[nombre] = L.circle(centro, { radius: radio, interactive: false, ...estilo }).addTo(estadoMapa.mapa);
    return;
  }
  estadoMapa[nombre].setLatLng(centro);
  estadoMapa[nombre].setStyle(estilo);
  animarRadio(estadoMapa[nombre], radio);
}




const capasBase = [];


// Carga el fondo del mapa y cambia si falla.
function obtenerCapaBase(indice) {
  if (capasBase[indice]) return capasBase[indice];
  const proveedor = PROVEEDORES_MAPA[indice];
  const capa = L.tileLayer(proveedor.url, proveedor.opciones);
  let errores = 0;
  let cargadas = 0;
  capa.on('tileload', () => { cargadas += 1; });
  capa.on('tileerror', () => {
    errores += 1;
    const siguiente = indice + 1;
    if (cargadas === 0 && errores >= ERRORES_PARA_CAMBIAR_MAPA && siguiente < PROVEEDORES_MAPA.length
        && estadoMapa.capaBase === capa) {
      estadoMapa.mapa.removeLayer(capa);
      estadoMapa.capaBase = obtenerCapaBase(siguiente).addTo(estadoMapa.mapa);
    }
  });
  capasBase[indice] = capa;
  return capa;
}





// Crea el mapa y sus controles.
function iniciarMapa(idContenedor, eventos) {
  const mapa = L.map(idContenedor, { minZoom: 10, maxZoom: 18, zoomSnap: 0.25 });
  estadoMapa.mapa = mapa;
  estadoMapa.alArrastrarPin = eventos.alArrastrarPin;

  estadoMapa.capaBase = obtenerCapaBase(0).addTo(mapa);
  const opcionesBase = {};
  PROVEEDORES_MAPA.forEach((proveedor, i) => { opcionesBase[proveedor.nombre] = obtenerCapaBase(i); });
  L.control.layers(opcionesBase, null, { position: 'bottomright' }).addTo(mapa);
  mapa.on('baselayerchange', (evento) => { estadoMapa.capaBase = evento.layer; });

  const capaGeo = L.geoJSON(LIMITES_ALCALDIAS, {
    style: { color: '#006B78', weight: 1.2, fillColor: '#006B78', fillOpacity: 0.04 },
    onEachFeature: (feature, capa) => {
      estadoMapa.capas[feature.properties.nombre] = capa;
      capa.bindTooltip(feature.properties.nombre, { sticky: true, className: 'etiqueta-mapa' });
    }
  }).addTo(mapa);

  mapa.on('click', (evento) => {
    const latitud = Number(evento.latlng.lat.toFixed(6));
    const longitud = Number(evento.latlng.lng.toFixed(6));
    eventos.alHacerClic(latitud, longitud, alcaldiaEnPunto(latitud, longitud));
  });

  
  const Panel = L.Control.extend({
    onAdd() {
      const div = L.DomUtil.create('div', 'panel-mapa oculto');
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    }
  });
  estadoMapa.panel = new Panel({ position: 'topright' }).addTo(mapa);

  
  const Centrar = L.Control.extend({
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar control-centrar');
      div.innerHTML = `<a href="#" role="button" title="Centrar la simulación" aria-label="Centrar la simulación">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg></a>`;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(div.querySelector('a'), 'click', (evento) => {
        L.DomEvent.preventDefault(evento);
        centrarSimulacion();
      });
      return div;
    }
  });
  new Centrar({ position: 'topleft' }).addTo(mapa);

  
  estadoMapa.cursor = L.tooltip({ direction: 'right', offset: [14, 0], className: 'etiqueta-cursor' });
  mapa.on('mousemove', (evento) => {
    if (!estadoMapa.guiaZona) return;
    const { centro, radio } = estadoMapa.guiaZona;
    const distancia = distanciaMetros(centro[0], centro[1], evento.latlng.lat, evento.latlng.lng);
    const eficiencia = eficienciaPorUbicacion(distancia, radio);
    estadoMapa.cursor
      .setLatLng(evento.latlng)
      .setContent(eficiencia === null
        ? `${Math.round(distancia)} m · fuera de la zona`
        : `${Math.round(distancia)} m · eficiencia ${Math.round(eficiencia * 100)} %`);
    if (!mapa.hasLayer(estadoMapa.cursor)) estadoMapa.cursor.addTo(mapa);
    estadoMapa.cursor.getElement().classList.toggle('fuera', eficiencia === null);
  });
  mapa.on('mouseout', () => { estadoMapa.cursor.remove(); });

  estadoMapa.limites = capaGeo.getBounds();
  mapa.fitBounds(capaGeo.getBounds());
  mapa.setMaxBounds(capaGeo.getBounds().pad(0.3));
}


// Marca la alcaldia del punto mostrado.
function resaltarAlcaldia(nombre) {
  if (estadoMapa.resaltada && estadoMapa.capas[estadoMapa.resaltada]) {
    estadoMapa.capas[estadoMapa.resaltada].setStyle({ weight: 1.2, fillOpacity: 0.04, color: '#006B78' });
  }
  estadoMapa.resaltada = nombre || null;
  if (nombre && estadoMapa.capas[nombre]) {
    estadoMapa.capas[nombre].setStyle({ weight: 2.5, fillOpacity: 0.1, color: '#0B3954' });
  }
}




// Crea el marcador visual del proyecto.
function iconoPin(color, etiqueta) {
  return L.divIcon({
    className: 'pin-proyecto',
    html: `<div class="pin" style="--color-pin:${color}">
             <svg viewBox="0 0 24 24"><path d="M4 20V9.5l8-5.5 8 5.5V20"/><path d="M9.5 20v-5.5h5V20"/></svg>
           </div>
           ${etiqueta ? `<span class="pin-etiqueta">${escaparMapa(etiqueta)}</span>` : ''}`,
    iconSize: [36, 46],
    iconAnchor: [18, 46]
  });
}


// Muestra el pin que puede mover el usuario.
function mostrarPin(latitud, longitud, opciones) {
  const posicion = [latitud, longitud];
  if (!estadoMapa.pin) {
    estadoMapa.pin = L.marker(posicion, { draggable: true, autoPan: true, zIndexOffset: 1000 }).addTo(estadoMapa.mapa);
    
    estadoMapa.pin.on('drag', (evento) => {
      ['predio', 'zonaAntes', 'zonaActual'].forEach((nombre) => {
        if (estadoMapa[nombre]) estadoMapa[nombre].setLatLng(evento.latlng);
      });
      if (estadoMapa.linea && estadoMapa.obra) estadoMapa.linea.setLatLngs([evento.latlng, estadoMapa.obra.getLatLng()]);
    });
    estadoMapa.pin.on('dragend', () => {
      const { lat, lng } = estadoMapa.pin.getLatLng();
      const latitud = Number(lat.toFixed(6));
      const longitud = Number(lng.toFixed(6));
      estadoMapa.alArrastrarPin(latitud, longitud, alcaldiaEnPunto(latitud, longitud));
    });
  }
  estadoMapa.pin.setLatLng(posicion);
  estadoMapa.pin.setIcon(iconoPin(opciones.color, opciones.etiqueta));
  if (opciones.arrastrable) estadoMapa.pin.dragging.enable();
  else estadoMapa.pin.dragging.disable();
}


// Retira el pin del proyecto.
function quitarPin() {
  quitarCapa('pin');
}


// Acerca el mapa a una ubicación.
function centrarEn(latitud, longitud, zoom = 16) {
  estadoMapa.mapa.flyTo([latitud, longitud], zoom, { duration: 0.6 });
}











// Dibuja el predio, zonas y obra.
function dibujarSimulacion(datos) {
  const { centro } = datos;

  circuloSimulacion('predio', centro, datos.radioPredio, {
    color: '#4A6272', weight: 1.5, dashArray: '2 4', fillColor: '#4A6272', fillOpacity: 0.12
  });

  const antes = datos.zonaAntes;
  circuloSimulacion('zonaAntes', centro, antes ? antes.radio : null, {
    color: antes ? COLORES_SEMAFORO[antes.nivel] : '#000', weight: 2, dashArray: '8 6', fill: false
  });

  const actual = datos.zonaActual;
  circuloSimulacion('zonaActual', centro, actual ? actual.radio : null, {
    color: actual ? COLORES_SEMAFORO[actual.nivel] : '#000',
    weight: datos.previa ? 2 : 2.5,
    dashArray: datos.previa ? '4 4' : null,
    fillColor: actual ? COLORES_SEMAFORO[actual.nivel] : '#000',
    fillOpacity: datos.previa ? 0.18 : 0.28
  });
  if (estadoMapa.predio) estadoMapa.predio.bringToFront();

  
  const o = datos.obra;
  if (!o) {
    quitarCapa('obra');
    quitarCapa('linea');
    return;
  }
  const posicionObra = [o.latitud, o.longitud];
  const icono = L.divIcon({
    className: 'icono-obra',
    html: `<div class="obra ${datos.obraPrevia ? 'obra-previa' : ''}" style="--color-obra:${COLOR_OBRA}">
             <svg viewBox="0 0 24 24">${ICONOS_OBRA[o.tipoObra] || ICONOS_OBRA['Pozo de Infiltración']}</svg>
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
  if (!estadoMapa.obra) {
    estadoMapa.obra = L.marker(posicionObra, { icon: icono, interactive: false, zIndexOffset: 500 }).addTo(estadoMapa.mapa);
  } else {
    estadoMapa.obra.setLatLng(posicionObra);
    estadoMapa.obra.setIcon(icono);
  }
  const textoLinea = `${Math.round(o.distancia)} m · eficiencia ${Math.round(o.eficiencia * 100)} %`;
  if (!estadoMapa.linea) {
    estadoMapa.linea = L.polyline([centro, posicionObra], {
      color: COLOR_OBRA, weight: 2, dashArray: '4 6', interactive: false
    }).addTo(estadoMapa.mapa);
  } else {
    estadoMapa.linea.setLatLngs([centro, posicionObra]);
  }
  estadoMapa.obra.unbindTooltip();
  estadoMapa.obra.bindTooltip(textoLinea, {
    permanent: true, direction: 'right', offset: [16, 0], className: 'etiqueta-linea'
  });
}


// Quita del mapa una simulacion.
function limpiarSimulacion() {
  ['predio', 'zonaAntes', 'zonaActual', 'obra', 'linea'].forEach(quitarCapa);
}




const ANILLOS_EFICIENCIA = [0.9, 0.75];



// Crea la etiqueta de eficiencia.
function etiquetaAnillo(centro, radio, texto) {
  
  const latitud = centro[0] - radio / 111320;
  return L.marker([latitud, centro[1]], {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({ className: 'etiqueta-anillo', html: `<span>${texto}</span>`, iconSize: [0, 0] })
  });
}



// Muestra anillos para colocar una obra.
function mostrarGuiaObra(centro, radio) {
  const zona = estadoMapa.guiaZona;
  const sinCambios = zona && zona.radio === radio && zona.centro[0] === centro[0] && zona.centro[1] === centro[1];
  estadoMapa.guiaZona = { centro, radio };
  estadoMapa.mapa.getContainer().classList.add('modo-obra');
  if (sinCambios && estadoMapa.guia) return;
  quitarCapa('guia');
  const capas = [];
  ANILLOS_EFICIENCIA.forEach((eficiencia) => {
    const r = distanciaParaEficiencia(eficiencia, radio);
    capas.push(L.circle(centro, {
      radius: r, interactive: false, color: COLOR_OBRA, weight: 1, opacity: 0.7, dashArray: '2 5', fill: false
    }));
    capas.push(etiquetaAnillo(centro, r, `${Math.round(eficiencia * 100)} %`));
  });
  capas.push(etiquetaAnillo(centro, radio, `${Math.round(EFICIENCIA_EN_BORDE * 100)} %`));
  estadoMapa.guia = L.layerGroup(capas).addTo(estadoMapa.mapa);
}


// Oculta la guia de ubicación de obra.
function ocultarGuiaObra() {
  quitarCapa('guia');
  estadoMapa.guiaZona = null;
  if (estadoMapa.cursor) estadoMapa.cursor.remove();
  if (estadoMapa.mapa) estadoMapa.mapa.getContainer().classList.remove('modo-obra');
}


// Encuadra el proyecto o la zona afectada.
function centrarSimulacion() {
  if (estadoMapa.zonaActual || estadoMapa.predio) {
    encuadrarZona();
  } else if (estadoMapa.pin) {
    estadoMapa.mapa.flyTo(estadoMapa.pin.getLatLng(), 16, { duration: 0.6 });
  } else {
    estadoMapa.mapa.flyToBounds(estadoMapa.limites, { duration: 0.6 });
  }
}


// Ajusta el mapa para ver la zona completa.
function encuadrarZona() {
  const zona = estadoMapa.zonaAntes || estadoMapa.zonaActual || estadoMapa.predio;
  if (!zona) return;
  const centro = zona.getLatLng();
  const radio = Math.max(zona.getRadius(), estadoMapa.zonaActual ? estadoMapa.zonaActual.getRadius() : 0);
  
  const panelVisible = !estadoMapa.panel.getContainer().classList.contains('oculto');
  estadoMapa.mapa.flyToBounds(centro.toBounds(radio * 2.3), {
    maxZoom: 18,
    duration: 0.6,
    paddingTopLeft: [20, 20],
    paddingBottomRight: [panelVisible && estadoMapa.mapa.getSize().x > 600 ? 310 : 20, 20]
  });
}


// Muestra o oculta los datos junto al mapa.
function actualizarPanelMapa(html) {
  const div = estadoMapa.panel.getContainer();
  div.innerHTML = html || '';
  div.classList.toggle('oculto', !html);
}


// Corrige el tamaño del mapa al cambiar pantalla.
function ajustarMapa() {
  if (estadoMapa.mapa) estadoMapa.mapa.invalidateSize();
}
