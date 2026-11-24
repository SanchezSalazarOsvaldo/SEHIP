// Por qué así: la misma página permite cambiar la contraseña voluntariamente o por obligación.
// Si la cuenta tiene una contraseña temporal, se oculta el regreso al panel.
// Por qué no permitir usarla: alguien más pudo verla al enviarse por correo.
// Cuenta de usuario: cambio de contraseña y recuperación por código.
// Los datos se validan aquí y también en el servidor.
// Las respuestas indican si la operación falló o se realizó correctamente.

// Envía peticiones JSON y detecta cuando ya no hay una sesión activa.
async function apiCuenta(url, metodo = 'GET', cuerpo = null) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  try {
    const respuesta = await fetch(url, opciones);
    const datos = await respuesta.json();
    if (respuesta.status === 401) return { ok: false, estado: 'sin-sesion', ...datos };
    return { ok: respuesta.ok, ...datos };
  } catch (error) {
    return { ok: false, error: 'No fue posible conectar con el servidor.' };
  }
}

// Consulta los datos del usuario de la sesión actual.
async function sesionCuenta() {
  const resultado = await apiCuenta('/api/sesion');
  return resultado.ok ? resultado.usuario : null;
}

// Cierra la sesión actual.
async function salirCuenta() {
  await apiCuenta('/api/logout', 'POST');
}

// Valida y envía el cambio de contraseña.
async function cambiarContrasena(actual, nueva, confirmacion) {
  const error = validarNuevaContrasena(nueva, confirmacion, actual);
  if (error) return { ok: false, error };
  return apiCuenta('/api/contrasena', 'POST', { actual, nueva, confirmacion });
}

// Paso 1: valida el correo y solicita el envío del código.
async function solicitarCodigoRecuperacion(correoTexto) {
  const correo = String(correoTexto ?? '').trim();
  if (!correoValido(correo)) return { ok: false, error: MENSAJES.correoInvalido };
  return apiCuenta('/api/recuperacion/solicitar', 'POST', { correo });
}

// Paso 2: valida el código y la nueva contraseña para restablecerla.
async function restablecerContrasena(correoTexto, codigoTexto, nueva, confirmacion) {
  const correo = String(correoTexto ?? '').trim();
  const codigo = String(codigoTexto ?? '').trim();
  const errorContrasena = validarNuevaContrasena(nueva, confirmacion);
  if (errorContrasena) return { ok: false, error: errorContrasena };
  if (!correoValido(correo) || !codigoRecuperacionValido(codigo)) return { ok: false, error: MENSAJES.codigoInvalido };
  return apiCuenta('/api/recuperacion/restablecer', 'POST', { correo, codigo, nueva, confirmacion });
}