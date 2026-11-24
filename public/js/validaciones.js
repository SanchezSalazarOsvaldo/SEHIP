// Arreglo con los períodos de retorno que se pueden utilizar en los cálculos.
const PERIODOS_RETORNO = [2, 5, 10, 20, 50];

// Constantes con los nombres de los roles que se manejan en el sistema.
const ROL_INGENIERO = 'Ingeniero Civil';
const ROL_ADMINISTRADOR = 'Administrador del Sistema';

// Arreglo con los tipos de obras de mitigación disponibles.
const TIPOS_OBRA = ['Pozo de Infiltración', 'Tanque de Tormenta', 'Jardín de Lluvia'];

// Objeto que guarda los mensajes de error y confirmación del sistema.
// Se utilizan para mantener los mismos mensajes en el navegador, servidor y pruebas.
const MENSAJES = {
  // RF-WEB-01: mensajes del inicio de sesión.
  loginIncorrecto: 'El correo electrónico o la contraseña son incorrectos',

  // RF-WEB-02: mensajes relacionados con el registro del proyecto.
  proyectoInvalido: 'El nombre del proyecto debe contener entre 1 y 100 caracteres y una alcaldía válida',
  ubicacionFuera: 'Seleccione una ubicación dentro de los límites de la Ciudad de México',

  // RF-WEB-03: mensajes de consulta del proyecto.
  proyectoNoEncontrado: 'El proyecto no fue encontrado o no existen registros disponibles',

  // RF-WEB-04: mensajes de las superficies y sus coeficientes.
  superficiesFaltantes: 'Debe registrar las superficies antes de calcular el coeficiente',
  superficiesFueraDeRango: 'Cada superficie debe estar entre 0.00 y 1,000,000.00 metros cuadrados y la superficie total entre 0.01 y 1,000,000.00 metros cuadrados',
  coeficientesNoRegistrados: 'La tabla maestra normativa no contiene coeficientes vigentes para superficie permeable (Cp) e impermeable (Ci)',

  // RF-WEB-05: mensajes del período de retorno y la intensidad de lluvia.
  periodoInvalido: 'Seleccione una alcaldía válida y un período de retorno permitido',
  intensidadNoRegistrada: 'No existe una intensidad de lluvia registrada para la alcaldía y el período de retorno seleccionados',

  // RF-WEB-06: mensajes de validación del caudal pico.
  parametrosIncompletos: 'Parámetros incompletos para el cálculo del caudal pico',
  parametrosFueraDeRango: 'Parámetros fuera de rango para el cálculo del caudal pico',

  // RF-WEB-07: mensajes de las obras de mitigación.
  capacidadFueraDeRango: 'La capacidad de almacenamiento debe estar entre 0.01 y 50000.00 metros cúbicos',
  tipoObraFaltante: 'Seleccione un tipo de obra de mitigación pluvial',
  caudalFaltante: 'Debe calcular el caudal pico antes de simular la mitigación',
  obraSinUbicacion: 'Coloque la obra de mitigación en el mapa dentro de la zona afectada',
  obraFueraDeZona: 'La obra de mitigación debe colocarse dentro de la zona afectada',
  ubicacionActualizada: 'Ubicación del proyecto actualizada',
  cpNoRegistrado: 'La tabla maestra normativa no contiene un coeficiente vigente para superficie permeable (Cp)',
  dentroDeCapacidad: 'El caudal ajustado está dentro de la capacidad de descarga permitida',
  excedeCapacidad: 'El caudal ajustado excede la capacidad de descarga permitida',

  // RF-ADM-01: mensajes del inicio de sesión del administrador.
  adminLoginIncorrecto: 'Las credenciales o los privilegios de administrador son incorrectos',

  // RF-ADM-02: mensajes de administración de incidencias.
  accesoDenegado: 'Acceso denegado: se requiere rol de administrador',
  sinIncidencias: 'No hay incidencias registradas',
  incidenciaEliminada: 'La incidencia fue eliminada del mapa',
  incidenciaNoEncontrada: 'La incidencia seleccionada no existe',
  incidenciaAprobada: 'La incidencia fue aprobada y ya es visible en los mapas',
  incidenciaYaAprobada: 'La incidencia ya estaba aprobada',

  // Mensajes para los reportes ciudadanos desde la aplicación móvil.
  reporteIncidenciaInvalido: 'Seleccione el tipo de incidencia y el nivel del agua',
  descripcionLarga: 'La descripción admite hasta 200 caracteres',
  reporteRecibido: 'Reporte recibido. Aparecerá en el mapa cuando un administrador lo valide',
  demasiadosReportes: 'Se recibieron demasiados reportes desde esta conexión. Intente más tarde',
  reportesSaturados: 'Por el momento no se reciben más reportes. Intente más tarde',

  // RF-ADM-03: mensajes de actualización de parámetros.
  parametroActualizado: 'El parámetro fue actualizado con éxito',
  valorFueraDeNorma: 'El valor está fuera de norma',
  valorNoNumerico: 'Ingrese un valor numérico con máximo dos decimales',

  // RF-ADM-04: mensajes de creación de cuentas.
  cuentaInvalida: 'El correo electrónico ya se encuentra registrado o los datos son inválidos',
  correoFallido: 'No fue posible enviar la contraseña temporal; la cuenta no fue creada',

  // RF-ADM-05: mensajes de búsqueda de usuarios.
  busquedaLongitud: 'Ingrese entre 1 y 50 caracteres',
  sinUsuarios: 'No se encontraron usuarios con el criterio ingresado',

  // RF-ADM-06: mensajes de modificación de roles.
  rolModificado: 'El rol de usuario fue modificado exitosamente',
  ultimoAdministrador: 'No es posible eliminar el último rol de administrador activo',
  rolIgual: 'El rol seleccionado es igual al rol actual de la cuenta',
  usuarioNoExiste: 'El usuario seleccionado no existe',
  administradorProtegido: 'El administrador inicial no puede cambiar de rol ni deshabilitarse',

  // RF-ADM-07: mensajes de desactivación de cuentas.
  cuentaPropia: 'No es posible desactivar la cuenta propia en uso',
  cuentaYaInactiva: 'La cuenta seleccionada ya se encuentra inactiva',
  cuentaDesactivada: 'La cuenta fue desactivada; ya no podrá iniciar sesión y su historial se conserva',

  // Mensajes de reactivación de cuentas.
  cuentaYaActiva: 'La cuenta seleccionada ya se encuentra activa',
  cuentaReactivada: 'La cuenta fue reactivada; ya puede iniciar sesión con su contraseña y su historial',

  // Mensajes de eliminación definitiva de información.
  cuentaEliminada: 'La cuenta y todos sus proyectos, simulaciones y reportes fueron eliminados definitivamente',
  cuentaActivaNoEliminable: 'Desactive la cuenta antes de eliminarla',
  cuentaPropiaNoEliminable: 'No es posible eliminar la cuenta propia en uso',
  administradorNoEliminable: 'El administrador inicial no puede eliminarse',
  proyectoEliminado: 'El proyecto fue eliminado junto con sus simulaciones y reportes',
  simulacionEliminada: 'La simulación fue eliminada del historial',
  simulacionNoEncontrada: 'La simulación seleccionada no existe',
  reporteEliminado: 'El reporte fue eliminado del historial',
  reporteNoEncontrado: 'El reporte seleccionado no existe',

  // RF-WEB-08: mensajes de generación de reportes.
  reporteIncompleto: 'Debe completar todos los cálculos antes de exportar',
  reporteFallido: 'No fue posible generar el reporte técnico',

  // Mensajes de cambio y recuperación de contraseña.
  contrasenaActualIncorrecta: 'La contraseña actual es incorrecta',
  contrasenaNuevaInvalida: 'La nueva contraseña debe tener entre 8 y 16 caracteres e incluir al menos una letra y un número',
  contrasenaNoCoincide: 'La confirmación no coincide con la nueva contraseña',
  contrasenaRepetida: 'La nueva contraseña debe ser diferente de la actual',
  contrasenaActualizada: 'Contraseña actualizada correctamente',
  cambioObligatorio: 'Debe cambiar la contraseña temporal antes de continuar',
  correoInvalido: 'Ingrese un correo electrónico válido',
  codigoEnviado: 'Si el correo pertenece a una cuenta activa, recibirá un código de verificación de 6 dígitos válido por 15 minutos',
  codigoFallido: 'No fue posible enviar el código de verificación; intente más tarde',
  codigoInvalido: 'El código de verificación es incorrecto o ya expiró',
  contrasenaRestablecida: 'Contraseña restablecida. Ya puede iniciar sesión con su nueva contraseña',

  // Mensajes de configuración del administrador inicial.
  configuracionHecha: 'El administrador inicial ya fue configurado',
  administradorInicialCreado: 'Administrador inicial creado. Bienvenido a SEHIP',

  // Mensajes de protección del servidor.
  demasiadasSolicitudes: 'Demasiadas solicitudes. Espere un momento e intente de nuevo',
  demasiadosIntentos: 'Demasiados intentos fallidos. Espere unos minutos e intente de nuevo',
  demasiadosCodigos: 'Se enviaron demasiados códigos a este correo. Espere una hora e intente de nuevo',
  limiteProyectos: 'Se alcanzó el límite de proyectos registrados por día. Intente de nuevo mañana',
  limiteReportes: 'Se alcanzó el límite diario de almacenamiento de reportes. Intente de nuevo mañana',
  solicitudMuyGrande: 'La solicitud excede el tamaño permitido',
  solicitudInvalida: 'La solicitud no tiene un formato válido',
  rutaNoEncontrada: 'La ruta solicitada no existe',

  // Mensajes relacionados con los ingenieros que participan en un proyecto.
  soloCreador: 'Solo el creador del proyecto puede realizar esta acción',
  ingenieroNoEncontrado: 'No existe un ingeniero civil activo con ese correo',
  ingenieroYaMiembro: 'El ingeniero ya forma parte del proyecto',
  limiteMiembros: 'El proyecto alcanzó el máximo de 10 ingenieros invitados',
  miembroNoEncontrado: 'El ingeniero seleccionado no forma parte del proyecto',
  creadorNoSeQuita: 'El creador del proyecto no puede quitarse; puede eliminar el proyecto',
  miembroQuitado: 'El ingeniero ya no forma parte del proyecto',
  salioDelProyecto: 'Ya no forma parte del proyecto'
};

// Constante que establece el máximo de ingenieros invitados por proyecto.
const MAXIMO_MIEMBROS = 10;

// Objeto que guarda los límites del semáforo según el caudal permitido.
// Verde: hasta 100 %, amarillo: hasta 150 % y rojo: más de 150 %.
const UMBRALES_SEMAFORO = { verde: 1.0, amarillo: 1.5 };

// Objeto que guarda el nombre y la descripción de cada nivel del semáforo.
const NIVELES_SEMAFORO = {
  verde: { etiqueta: 'Riesgo bajo', descripcion: 'El caudal está dentro de la capacidad de descarga permitida.' },
  amarillo: { etiqueta: 'Riesgo medio', descripcion: 'El caudal excede hasta en 50 % la capacidad de descarga permitida; existe riesgo de encharcamiento.' },
  rojo: { etiqueta: 'Riesgo alto', descripcion: 'El caudal excede en más de 50 % la capacidad de descarga permitida; existe riesgo alto de encharcamiento o inundación.' }
};

// Constante que representa una lámina de encharcamiento de 5 cm.
// Se utiliza para calcular el área aproximada de la zona afectada.
const LAMINA_ENCHARCAMIENTO = 0.05;

// Constante que indica que la obra conserva el 50 % de su eficiencia cuando está en el borde de la zona afectada.
const EFICIENCIA_EN_BORDE = 0.5;

// Constante que establece el tamaño máximo permitido para los reportes PDF: 10 MB.
const TAMANO_MAXIMO_REPORTE = 10 * 1024 * 1024;

// Función que sirve para redondear un número a la cantidad de decimales indicada.
function redondear(valor, decimales) {

  // Se calcula el factor multiplicando 10 por sí mismo según los decimales que necesitamos.
  // Por ejemplo, para 2 decimales el resultado es 100.
  const factor = 10 ** decimales;

  // Se suma Number.EPSILON para corregir pequeños errores de precisión de los decimales.
  // Math.round redondea el resultado y al dividir entre factor se recuperan los decimales originales.
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

// Función que convierte el dato ingresado por el usuario en un número.
function leerCantidad(valor) {

  // Se revisa si el valor no existe o está vacío desde su origen.
  if (valor === undefined || valor === null) return null;

  // Se convierte el dato a texto y se eliminan los espacios de los extremos.
  const texto = String(valor).trim();

  // Se revisa si el texto quedó vacío después de quitar los espacios.
  if (texto === '') return null;

  // Expresión regular que permite únicamente números positivos con máximo dos decimales.
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return NaN;

  // Se convierte el texto validado a tipo numérico.
  return Number(texto);
}

// RF-WEB-01 y RF-ADM-01: validación de credenciales.

// Función que valida que el correo tenga un formato correcto y entre 5 y 50 caracteres.
function correoValido(correo) {

  // Se revisa que sea texto, que cumpla con la longitud y que tenga formato de correo.
  return typeof correo === 'string' && correo.length >= 5 && correo.length <= 50
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Función que revisa que el correo y la contraseña cumplan con sus formatos.
function credencialesConFormatoValido(correo, contrasena) {

  // Se valida el correo y que la contraseña tenga entre 8 y 16 caracteres.
  return correoValido(correo) && typeof contrasena === 'string'
    && contrasena.length >= 8 && contrasena.length <= 16;
}

// RF-WEB-02: validación del nombre del proyecto.

// Función que revisa que el nombre del proyecto tenga entre 1 y 100 caracteres.
function nombreProyectoValido(nombre) {

  // Se comprueba que el dato recibido sea texto.
  if (typeof nombre !== 'string') return false;

  // Se eliminan los espacios de los extremos y se obtiene la longitud del nombre.
  const largo = nombre.trim().length;

  // Se devuelve true si cumple con el rango permitido y false si no lo cumple.
  return largo >= 1 && largo <= 100;
}

// RF-WEB-04: validación de superficies y cálculo del coeficiente.

// Función que valida las superficies permeable e impermeable y devuelve sus valores.
function validarSuperficies(permeable, impermeable) {

  // Se convierten los datos ingresados a números.
  const ap = leerCantidad(permeable);
  const ai = leerCantidad(impermeable);

  // Se revisa que las dos superficies tengan algún valor.
  if (ap === null || ai === null) {
    return { error: MENSAJES.superficiesFaltantes };
  }

  // Se comprueba que sean números válidos y que ninguna superficie supere 1,000,000 m².
  if (Number.isNaN(ap) || Number.isNaN(ai) || ap > 1000000 || ai > 1000000) {
    return { error: MENSAJES.superficiesFueraDeRango };
  }

  // Se suman las dos superficies y se redondea el total a dos decimales.
  const total = redondear(ap + ai, 2);

  // Se revisa que la superficie total esté dentro del rango permitido.
  if (total < 0.01 || total > 1000000) {
    return { error: MENSAJES.superficiesFueraDeRango };
  }

  // Se devuelven las dos superficies y el total cuando todos los datos son correctos.
  return { ap, ai, total };
}

// Función que calcula el coeficiente de escurrimiento usando las superficies y sus coeficientes.
// Fórmula: C = (Cp * Ap + Ci * Ai) / (Ap + Ai).
function calcularCoeficiente(cp, ci, ap, ai) {

  // Se realiza la operación y se redondea el resultado a dos decimales.
  return redondear((cp * ap + ci * ai) / (ap + ai), 2);
}

// RF-WEB-05: validación del período de retorno.

// Función que revisa si el período seleccionado está dentro de los permitidos.
function periodoValido(periodo) {

  // Se convierte el valor a número y se comprueba si existe en el arreglo PERIODOS_RETORNO.
  return PERIODOS_RETORNO.includes(Number(periodo));
}

// RF-WEB-06: validación y cálculo del caudal pico.

// Función que revisa si los datos necesarios para calcular el caudal están completos y dentro del rango.
function validarParametrosCaudal(coeficiente, intensidad, superficieTotal) {

  // Se comprueba que ninguno de los datos esté vacío o sea nulo.
  if (coeficiente == null || intensidad == null || superficieTotal == null) {
    return MENSAJES.parametrosIncompletos;
  }

  // Se revisa que cada dato esté dentro de los límites establecidos.
  const fueraDeRango = coeficiente < 0.05 || coeficiente > 0.95
    || intensidad < 10 || intensidad > 250
    || superficieTotal < 0.01 || superficieTotal > 1000000;

  // Se devuelve el mensaje de error si algún dato está fuera del rango; si todo está bien devuelve null.
  return fueraDeRango ? MENSAJES.parametrosFueraDeRango : null;
}

// Función que calcula el caudal pico mediante el Método Racional.
// Fórmula: Q = C * I * A / 360, donde el área debe estar en hectáreas.
function calcularCaudalPico(coeficiente, intensidad, superficieM2) {

  // Se convierten los metros cuadrados a hectáreas dividiendo entre 10,000.
  const hectareas = superficieM2 / 10000;

  // Se sustituyen los valores en la fórmula y el resultado se redondea a tres decimales.
  return redondear((coeficiente * intensidad * hectareas) / 360, 3);
}

// RF-WEB-07: validación y simulación de obras de mitigación.

// Función que revisa si el tipo de obra seleccionado existe en el catálogo.
function tipoObraValido(tipo) {

  // Se comprueba si el tipo recibido está dentro del arreglo TIPOS_OBRA.
  return TIPOS_OBRA.includes(tipo);
}

// Función que valida la capacidad de almacenamiento de la obra.
function leerCapacidad(valor) {

  // Se convierte el dato ingresado a número.
  const capacidad = leerCantidad(valor);

  // Se revisa que el valor exista y que sea un número válido.
  if (capacidad === null || Number.isNaN(capacidad)) return null;

  // Se comprueba que la capacidad esté entre 0.01 y 50,000 m³.
  if (capacidad < 0.01 || capacidad > 50000) return null;

  // Se devuelve la capacidad cuando cumple con las validaciones.
  return capacidad;
}

// Función que simula cuánto caudal puede retener la obra de mitigación.
function simularMitigacion({ caudalPico, capacidad, cp, intensidad, superficieM2, eficiencia = 1 }) {

  // Se calcula el caudal retenido dividiendo la capacidad entre 3,600 segundos
  // y multiplicando por la eficiencia de la ubicación de la obra.
  const retencion = redondear((capacidad / 3600) * eficiencia, 6);

  // Se resta la retención al caudal pico y se evita que el resultado sea negativo.
  const caudalAjustado = Math.max(0, redondear(caudalPico - retencion, 3));

  // Se calcula el caudal máximo permitido utilizando el coeficiente permeable.
  const caudalPermitido = calcularCaudalPico(cp, intensidad, superficieM2);

  // Se compara el caudal ajustado con el permitido para saber si la obra es suficiente.
  const dentroDeCapacidad = caudalAjustado <= caudalPermitido;

  // Se devuelven los resultados de la simulación y el mensaje que corresponde.
  return {
    retencion,
    caudalAjustado,
    caudalPermitido,
    dentroDeCapacidad,
    mensaje: dentroDeCapacidad ? MENSAJES.dentroDeCapacidad : MENSAJES.excedeCapacidad
  };
}