// preventDefault evita que el formulario recargue la página.
// textContent muestra los mensajes como texto y evita que se interpreten como HTML.
// Página de inicio de sesión (RF-WEB-01).
// Obtiene el formulario y el espacio donde se muestra el error.
const formulario = document.getElementById('form-login');
const caja = document.getElementById('mensaje-login');

// Si ya hay una sesión activa, abre directamente el panel.
(async () => {
  if (await usuarioActivo()) window.location.href = 'panel.html';
})();

// Envía los datos sin recargar la página y revisa el resultado del acceso.
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  caja.classList.add('oculto');

  const resultado = await iniciarSesion(formulario.correo.value, formulario.contrasena.value);

  if (resultado.ok) {
    // Si la contraseña es temporal, primero debe cambiarse.
    window.location.href = resultado.usuario.debeCambiarContrasena ? 'contrasena.html' : 'panel.html';
    return;
  }
  caja.querySelector('span').textContent = resultado.error;
  caja.classList.remove('oculto');
});