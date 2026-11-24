// preventDefault evita que el formulario recargue la página.
// Los mensajes se muestran con textContent para evitar que se interpreten como HTML.
// Página de acceso administrativo (RF-ADM-01) y creación del administrador inicial.
// Busca elementos de la página por su id.
const $ = (id) => document.getElementById(id);
const formulario = $('form-login');
const caja = $('mensaje-login');

// Muestra mensajes de error o éxito sin interpretar el texto como HTML.
function mostrarMensajeConfiguracion(tipo, texto) {
  const iconos = { error: 'i-triangulo', exito: 'i-check' };
  $('mensaje-configuracion').innerHTML = `
    <div class="alerta alerta-${tipo}" role="${tipo === 'error' ? 'alert' : 'status'}">
      <svg class="icono"><use href="#${iconos[tipo]}"/></svg>
      <span></span>
    </div>`;
  $('mensaje-configuracion').querySelector('span').textContent = texto;
}

// Si falta crear el administrador, muestra el formulario de configuración.
// Si ya hay una sesión de administrador, abre directamente su panel.
(async () => {
  if ((await estadoConfiguracionInicial()).pendiente) {
    $('bloque-login').classList.add('oculto');
    $('bloque-configuracion').classList.remove('oculto');
    return;
  }
  if ((await sesionAdministrador()).estado === 'ok') window.location.href = 'admin-panel.html';
})();

// RF-ADM-01: valida el acceso y dirige al panel correspondiente.
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  caja.classList.add('oculto');
  const resultado = await iniciarSesionAdmin(formulario.correo.value, formulario.contrasena.value);
  if (resultado.ok) {
    // Si la contraseña es temporal, primero debe cambiarse.
    window.location.href = resultado.usuario.debeCambiarContrasena ? 'contrasena.html' : 'admin-panel.html';
    return;
  }
  caja.querySelector('span').textContent = resultado.error;
  caja.classList.remove('oculto');
});

// Crea la cuenta del administrador inicial.
// Desactiva el botón mientras espera para evitar envíos repetidos.
$('form-configuracion').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = evento.target.querySelector('button');
  boton.disabled = true;
  const resultado = await configurarAdministradorInicial(
    $('config-nombre').value, $('config-correo').value, $('config-contrasena').value, $('config-confirmacion').value
  );
  boton.disabled = false;
  if (!resultado.ok) {
    mostrarMensajeConfiguracion('error', resultado.error);
    return;
  }
  boton.disabled = true;
  mostrarMensajeConfiguracion('exito', resultado.mensaje);
  setTimeout(() => { window.location.href = 'admin-panel.html'; }, 1200);
});