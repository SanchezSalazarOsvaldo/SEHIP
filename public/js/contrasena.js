// Por qué así: la misma página permite cambiar la contraseña voluntariamente o por obligación.
// debeCambiarContrasena oculta el regreso al panel cuando la cuenta usa una contraseña temporal.
// Por qué no mantener la contraseña temporal: pudo ser vista por alguien más al enviarse por correo.
// Página para cambiar la contraseña de cualquier rol.
// Si el cambio es obligatorio, se oculta el enlace al panel y el servidor bloquea las demás operaciones.
// Busca elementos de la página por su id y guarda los datos del usuario actual.
const $ = (id) => document.getElementById(id);
let usuarioCuenta = null;

// Define a qué panel y página de acceso debe ir cada rol.
const panelDelRol = (usuario) => (usuario.rol === ROL_ADMINISTRADOR ? 'admin-panel.html' : 'panel.html');
const accesoDelRol = (usuario) => (usuario && usuario.rol === ROL_ADMINISTRADOR ? 'admin.html' : 'index.html');

// Muestra mensajes de error o éxito sin interpretar el texto como HTML.
function mostrarAviso(tipo, texto) {
  const iconos = { error: 'i-triangulo', exito: 'i-check' };
  $('mensaje').innerHTML = `
    <div class="alerta alerta-${tipo}" role="${tipo === 'error' ? 'alert' : 'status'}">
      <svg class="icono"><use href="#${iconos[tipo]}"/></svg>
      <span></span>
    </div>`;
  $('mensaje').querySelector('span').textContent = texto;
}

// Al cargar: verifica la sesión y muestra el aviso si el cambio es obligatorio.
(async () => {
  usuarioCuenta = await sesionCuenta();
  if (!usuarioCuenta) {
    window.location.href = 'index.html';
    return;
  }
  $('correo-cuenta').textContent = `${usuarioCuenta.correo} · ${usuarioCuenta.rol}`;
  $('volver').href = panelDelRol(usuarioCuenta);
  if (usuarioCuenta.debeCambiarContrasena) {
    $('aviso-obligatorio').classList.remove('oculto');
    $('etiqueta-actual').textContent = 'Contraseña temporal (recibida por correo)';
    $('bloque-volver').classList.add('oculto');
  }
})();

// Valida el cambio y, si se completa, dirige al panel del usuario.
$('form-contrasena').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const resultado = await cambiarContrasena($('actual').value, $('nueva').value, $('confirmacion').value);
  if (!resultado.ok) {
    if (resultado.estado === 'sin-sesion') {
      window.location.href = 'index.html';
      return;
    }
    mostrarAviso('error', resultado.error);
    return;
  }
  evento.target.querySelector('button').disabled = true;
  mostrarAviso('exito', `${resultado.mensaje}. Entrando al panel...`);
  setTimeout(() => { window.location.href = panelDelRol(resultado.usuario); }, 1500);
});

// Cierra la sesión y regresa a la página de acceso según el rol.
$('salir').addEventListener('click', async (evento) => {
  evento.preventDefault();
  await salirCuenta();
  window.location.href = accesoDelRol(usuarioCuenta);
});