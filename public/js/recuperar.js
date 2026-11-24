// Por qué así: la recuperación se divide en dos pasos para verificar el correo antes de cambiar la contraseña.
// Por qué mostrar el mismo mensaje: evita revelar si un correo está registrado.
// Página de recuperación para ambos roles.
// Paso 1: solicita un código de 6 dígitos por correo.
// Paso 2: verifica el código y guarda la nueva contraseña.
// El parámetro origen=admin permite regresar al acceso administrativo.
// Busca elementos de la página por su id.
const $ = (id) => document.getElementById(id);

// Define a qué página de acceso debe regresar el usuario.
const paginaAcceso = new URLSearchParams(window.location.search).get('origen') === 'admin' ? 'admin.html' : 'index.html';

// Guarda el correo para utilizarlo en el segundo paso.
let correoSolicitado = '';

$('volver').href = paginaAcceso;

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

// Cambia entre los formularios de solicitud y restablecimiento.
function mostrarPaso(paso) {
  $('form-solicitar').classList.toggle('oculto', paso !== 1);
  $('form-restablecer').classList.toggle('oculto', paso !== 2);
  $('mensaje').innerHTML = '';
}

// Paso 1: solicita el código y desactiva el botón mientras espera la respuesta.
$('form-solicitar').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = evento.target.querySelector('button');
  boton.disabled = true;
  const resultado = await solicitarCodigoRecuperacion($('correo').value);
  boton.disabled = false;
  if (!resultado.ok) {
    mostrarAviso('error', resultado.error);
    return;
  }
  correoSolicitado = $('correo').value.trim();
  mostrarPaso(2);
  $('aviso-codigo').querySelector('span').textContent = `${resultado.mensaje} (${correoSolicitado}).`;
  $('codigo').focus();
});

// Paso 2: verifica el código y guarda la nueva contraseña.
$('form-restablecer').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const resultado = await restablecerContrasena(correoSolicitado, $('codigo').value, $('nueva').value, $('confirmacion').value);
  if (!resultado.ok) {
    mostrarAviso('error', resultado.error);
    return;
  }
  $('form-restablecer').classList.add('oculto');
  mostrarAviso('exito', resultado.mensaje);
  $('mensaje').insertAdjacentHTML('beforeend',
    `<a class="boton boton-ancho boton-separado" href="${paginaAcceso}">Ir a iniciar sesión</a>`);
});

// Permite regresar al primer paso y escribir otro correo.
$('otro-correo').addEventListener('click', (evento) => {
  evento.preventDefault();
  $('form-restablecer').reset();
  mostrarPaso(1);
  $('correo').focus();
});