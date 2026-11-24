// Las funciones usan async y await para esperar la respuesta del servidor sin detener la página.
// Se valida la información antes de enviarla para evitar peticiones con datos incorrectos.
// Se usa fetch en lugar de XMLHttpRequest porque permite manejar las peticiones de forma más sencilla.
// Este módulo conecta la simulación con la API y trabaja con los datos guardados en la base de datos.
// Las validaciones se hacen primero en el navegador y después en el servidor.
// Las funciones regresan el resultado de la operación y, cuando hay un error, el mensaje correspondiente.

// Envía peticiones a la API y revisa si la sesión sigue activa.
// Si la sesión venció, regresa al inicio de sesión.
// Si la contraseña necesita cambiarse, manda al usuario a esa página.
async function api(url, metodo = 'GET', cuerpo = null, redirigirSinSesion = true) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  try {
    const respuesta = await fetch(url, opciones);
    if (respuesta.status === 401 && redirigirSinSesion) {
      window.location.href = 'index.html';
      return { ok: false, error: 'Debe iniciar sesión' };
    }
    const datos = await respuesta.json();
    if (respuesta.status === 403 && datos.estado === 'cambio-obligatorio') {
      window.location.href = 'contrasena.html';
      return { ok: false, error: datos.error };
    }
    return { ok: respuesta.ok, ...datos };
  } catch (error) {
    return { ok: false, error: 'No fue posible conectar con el servidor.' };
  }
}

// ---------- RF-WEB-01: sesión ----------

// Limpia los espacios del correo y revisa que los datos tengan el formato correcto antes de iniciar sesión.
async function iniciarSesion(correoTexto, contrasena) {
  const correo = String(correoTexto).trim();
  if (!credencialesConFormatoValido(correo, contrasena)) {
    return { ok: false, error: MENSAJES.loginIncorrecto };
  }
  return api('/api/login', 'POST', { correo, contrasena }, false);
}

// Consulta quién inició sesión.
// Solo permite entrar al módulo si la cuenta tiene el rol de Ingeniero Civil.
async function usuarioActivo() {
  const resultado = await api('/api/sesion', 'GET', null, false);
  return resultado.ok && resultado.usuario.rol === ROL_INGENIERO ? resultado.usuario : null;
}

// Envía la petición para cerrar la sesión del usuario.
async function cerrarSesion() {
  await api('/api/logout', 'POST', null, false);
}

// ---------- Catálogos ----------

// Obtiene las alcaldías para llenar el selector del registro.
// Si ocurre un error, regresa una lista vacía.
async function obtenerAlcaldias() {
  const resultado = await api('/api/alcaldias');
  return resultado.ok ? resultado.alcaldias : [];
}

// Consulta los coeficientes Cp y Ci guardados en la tabla maestra.
// Si todavía no hay datos, regresa ambos valores como null.
async function obtenerCoeficientes() {
  const resultado = await api('/api/coeficientes');
  return resultado.ok ? resultado.coeficientes : { Cp: null, Ci: null };
}

// Obtiene las intensidades de lluvia de la alcaldía según cada período de retorno.
async function obtenerIntensidadesAlcaldia(idAlcaldia) {
  const resultado = await api(`/api/alcaldias/${idAlcaldia}/intensidades`);
  return resultado.ok ? resultado.intensidades : {};
}

// ---------- RF-WEB-02 y RF-WEB-03: proyectos ----------

// Revisa que el nombre y la alcaldía sean válidos y que la ubicación esté dentro de una alcaldía.
// Si todo está correcto, envía los datos para registrar el proyecto.
async function registrarProyecto(nombre, idAlcaldia, latitud, longitud) {
  if (!nombreProyectoValido(nombre) || !idAlcaldia) {
    return { ok: false, error: MENSAJES.proyectoInvalido };
  }
  if (!coordenadasValidas(latitud, longitud) || !alcaldiaEnPunto(latitud, longitud)) {
    return { ok: false, error: MENSAJES.ubicacionFuera };
  }
  return api('/api/proyectos', 'POST', { nombre, idAlcaldia, latitud, longitud });
}

// Valida la nueva ubicación antes de enviarla.
// El servidor actualiza la alcaldía y los datos relacionados con el proyecto.
async function moverProyecto(idProyecto, latitud, longitud) {
  if (!coordenadasValidas(latitud, longitud) || !alcaldiaEnPunto(latitud, longitud)) {
    return { ok: false, error: MENSAJES.ubicacionFuera };
  }
  return api(`/api/proyectos/${idProyecto}/ubicacion`, 'POST', { latitud, longitud });
}

// Obtiene una página del historial de proyectos.
async function listarProyectos(pagina) {
  return api(`/api/proyectos?pagina=${pagina}`);
}

// Consulta los datos de un proyecto para mostrar su información completa.
async function consultarProyecto(idProyecto) {
  return api(`/api/proyectos/${idProyecto}`);
}

// ---------- RF-WEB-04 a RF-WEB-07: cálculos ----------

// Valida las superficies y las envía para calcular el coeficiente de escurrimiento C.
async function calcularCoeficienteProyecto(idProyecto, superficiePermeable, superficieImpermeable) {
  const superficies = validarSuperficies(superficiePermeable, superficieImpermeable);
  if (superficies.error) return { ok: false, error: superficies.error };
  return api(`/api/proyectos/${idProyecto}/coeficiente`, 'POST', { superficiePermeable, superficieImpermeable });
}

// Revisa que el período de retorno sea válido y solicita la intensidad de lluvia.
async function consultarIntensidadProyecto(idProyecto, periodoRetorno) {
  if (!periodoValido(periodoRetorno)) return { ok: false, error: MENSAJES.periodoInvalido };
  return api(`/api/proyectos/${idProyecto}/intensidad`, 'POST', { periodoRetorno });
}

// Solicita al servidor calcular el caudal pico usando los datos del proyecto.
async function calcularCaudalProyecto(idProyecto) {
  return api(`/api/proyectos/${idProyecto}/caudal`, 'POST');
}

// Revisa el tipo de obra, su capacidad y su ubicación antes de guardar la simulación.
async function simularMitigacionProyecto(idProyecto, tipoObra, capacidad, latitud, longitud) {
  if (!tipoObraValido(tipoObra)) return { ok: false, error: MENSAJES.tipoObraFaltante };
  if (leerCapacidad(capacidad) === null) return { ok: false, error: MENSAJES.capacidadFueraDeRango };
  if (!coordenadasValidas(latitud, longitud)) return { ok: false, error: MENSAJES.obraSinUbicacion };
  return api(`/api/proyectos/${idProyecto}/mitigacion`, 'POST', { tipoObra, capacidad, latitud, longitud });
}

// ---------- RF-WEB-08: copia del reporte técnico en el historial ----------

// Envía el nombre y el contenido del PDF para guardar una copia en el historial del proyecto.
async function guardarReporte(idProyecto, reporte) {
  return api(`/api/proyectos/${idProyecto}/reportes`, 'POST', {
    nombreArchivo: reporte.nombreArchivo,
    contenidoBase64: reporte.base64
  });
}

// ---------- Eliminar proyecto, simulación o reporte ----------

// Elimina el proyecto junto con las simulaciones y los reportes que tiene guardados.
async function eliminarProyecto(idProyecto) {
  return api(`/api/proyectos/${idProyecto}`, 'DELETE');
}

// Elimina una simulación específica del proyecto.
async function eliminarSimulacion(idProyecto, idSimulacion) {
  return api(`/api/proyectos/${idProyecto}/simulaciones/${idSimulacion}`, 'DELETE');
}

// Elimina un reporte específico del historial del proyecto.
async function eliminarReporte(idProyecto, idReporte) {
  return api(`/api/proyectos/${idProyecto}/reportes/${idReporte}`, 'DELETE');
}

// ---------- Equipo del proyecto ----------

// Limpia el correo y revisa que tenga un formato válido antes de enviar la invitación.
async function invitarIngeniero(idProyecto, correo) {
  const texto = String(correo ?? '').trim();
  if (!correoValido(texto)) return { ok: false, error: MENSAJES.correoInvalido };
  return api(`/api/proyectos/${idProyecto}/miembros`, 'POST', { correo: texto });
}

// Permite al creador quitar a un integrante o al invitado salir del proyecto.
async function quitarIngeniero(idProyecto, idUsuario) {
  return api(`/api/proyectos/${idProyecto}/miembros/${idUsuario}`, 'DELETE');
}