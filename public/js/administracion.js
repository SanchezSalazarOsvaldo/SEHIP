// Por qué así: apiAdmin centraliza la petición y convierte los códigos 401 y 403 en estados que la página entiende.
// Por qué no repetir fetch: se evitaría copiar el mismo manejo de errores en cada función.
// Módulo de administración: se comunica con las rutas de /api/admin.
// Los formularios se validan aquí y también en el servidor.
// Cada operación devuelve { ok: false, error, estado } o { ok: true, ... }.
// estado puede ser: 'sin-sesion', 'denegado' o 'cambio-obligatorio'.

// Envía una petición JSON y traduce los errores de sesión o permisos.
async function apiAdmin(url, metodo = 'GET', cuerpo = null) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  try {
    const respuesta = await fetch(url, opciones);
    const datos = await respuesta.json();
    if (respuesta.status === 401) return { ok: false, estado: 'sin-sesion', ...datos };
    if (respuesta.status === 403) return { ok: false, estado: datos.estado || 'denegado', ...datos };
    return { ok: respuesta.ok, ...datos };
  } catch (error) {
    return { ok: false, error: 'No fue posible conectar con el servidor.' };
  }
}

// ---------- RF-ADM-01: sesión ----------

// Valida el formato del correo y envía las credenciales.
async function iniciarSesionAdmin(correoTexto, contrasena) {
  const correo = String(correoTexto).trim();
  if (!credencialesConFormatoValido(correo, contrasena)) {
    return { ok: false, error: MENSAJES.adminLoginIncorrecto };
  }
  return apiAdmin('/api/admin/login', 'POST', { correo, contrasena });
}

// Consulta si hay una sesión de administrador activa.
async function sesionAdministrador() {
  const resultado = await apiAdmin('/api/admin/sesion');
  if (resultado.ok) return { estado: 'ok', usuario: resultado.usuario };
  if (resultado.estado === 'denegado') return { estado: 'denegado', usuario: resultado.usuario };
  return { estado: 'sin-sesion' };
}

// Cierra la sesión actual.
async function cerrarSesionAdmin() {
  await apiAdmin('/api/logout', 'POST');
}

// ---------- Configuración del administrador inicial ----------

// Consulta si todavía falta crear el administrador inicial.
async function estadoConfiguracionInicial() {
  const resultado = await apiAdmin('/api/admin/configuracion-inicial');
  return { pendiente: resultado.ok && resultado.pendiente };
}

// Valida los datos y crea la cuenta del administrador inicial.
async function configurarAdministradorInicial(nombre, correo, contrasena, confirmacion) {
  if (!datosCuentaValidos(String(nombre).trim(), String(correo).trim(), ROL_ADMINISTRADOR)) {
    return { ok: false, error: MENSAJES.cuentaInvalida };
  }
  const errorContrasena = validarNuevaContrasena(contrasena, confirmacion);
  if (errorContrasena) return { ok: false, error: errorContrasena };
  return apiAdmin('/api/admin/configuracion-inicial', 'POST', { nombre, correo, contrasena, confirmacion });
}

// ---------- RF-ADM-02 y RF-ADM-03 ----------

// Obtiene los datos generales que muestra el panel.
async function obtenerPanelControl() {
  return apiAdmin('/api/admin/panel');
}

// Consulta los valores de Cp, Ci e intensidades por alcaldía.
async function obtenerTablaMaestra() {
  return apiAdmin('/api/admin/tabla-maestra');
}

// Valida y guarda un parámetro de la tabla maestra.
async function actualizarParametro(parametro) {
  const validacion = validarValorParametro(parametro.tipo, parametro.valor);
  if (validacion.error) return { ok: false, error: validacion.error };
  return apiAdmin('/api/admin/tabla-maestra', 'POST', parametro);
}

// ---------- RF-ADM-04 a RF-ADM-07: usuarios ----------

// Muestra todas las cuentas o busca usuarios por texto.
async function buscarUsuarios(texto = null) {
  if (texto === null) return apiAdmin('/api/admin/usuarios');
  if (!busquedaValida(texto)) return { ok: false, error: MENSAJES.busquedaLongitud };
  return apiAdmin(`/api/admin/usuarios?buscar=${encodeURIComponent(texto)}`);
}

// Valida los datos y crea una cuenta con el rol indicado.
async function crearCuenta(nombre, correo, rol) {
  if (!datosCuentaValidos(nombre, String(correo).trim(), rol)) {
    return { ok: false, error: MENSAJES.cuentaInvalida };
  }
  return apiAdmin('/api/admin/usuarios', 'POST', { nombre, correo, rol });
}

// Cambia el rol de un usuario.
async function modificarRol(idUsuario, rol) {
  return apiAdmin(`/api/admin/usuarios/${idUsuario}/rol`, 'POST', { rol });
}

// Desactiva la cuenta de un usuario.
async function desactivarCuenta(idUsuario) {
  return apiAdmin(`/api/admin/usuarios/${idUsuario}/desactivar`, 'POST');
}

// Reactiva una cuenta desactivada.
async function reactivarCuenta(idUsuario) {
  return apiAdmin(`/api/admin/usuarios/${idUsuario}/reactivar`, 'POST');
}

// Aprueba una incidencia reportada por un ciudadano.
async function aprobarIncidencia(idIncidencia) {
  return apiAdmin(`/api/admin/incidencias/${idIncidencia}/aprobar`, 'POST');
}

// Elimina una incidencia.
async function eliminarIncidencia(idIncidencia) {
  return apiAdmin(`/api/admin/incidencias/${idIncidencia}`, 'DELETE');
}

// Elimina una cuenta de usuario.
async function eliminarCuenta(idUsuario) {
  return apiAdmin(`/api/admin/usuarios/${idUsuario}`, 'DELETE');
}