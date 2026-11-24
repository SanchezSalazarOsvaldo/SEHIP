// Se comparte entre el navegador y el servidor para mantener las mismas reglas.
// El servidor también valida los datos porque no se puede confiar en lo que llega desde el navegador.
// El navegador valida primero para mostrar los errores sin esperar una respuesta del servidor.

// Períodos de retorno permitidos en la tabla de intensidades.
const PERIODOS_RETORNO = [2, 5, 10, 20, 50];

// Roles que utiliza el sistema.
const ROL_INGENIERO = 'Ingeniero Civil';
const ROL_ADMINISTRADOR = 'Administrador del Sistema';
const ROLES = [ROL_INGENIERO, ROL_ADMINISTRADOR];

// Tipos de obras de mitigación disponibles.
const TIPOS_OBRA = ['Pozo de Infiltración', 'Tanque de Tormenta', 'Jardín de Lluvia'];

// Objeto que guarda los mensajes oficiales del sistema.
const MENSAJES = {
  // RF-WEB-01
  loginIncorrecto: 'El correo electrónico o la contraseña son incorrectos',

  // RF-WEB-02
  proyectoInvalido: 'El nombre del proyecto debe contener entre 1 y 100 caracteres y una alcaldía válida',
  ubicacionFuera: 'Seleccione una ubicación dentro de los límites de la Ciudad de México',

  // RF-WEB-03
  proyectoNoEncontrado: 'El proyecto no fue encontrado o no existen registros disponibles',

  // RF-WEB-04
  superficiesFaltantes: 'Debe registrar las superficies antes de calcular el coeficiente',
  superficiesFueraDeRango: 'Cada superficie debe estar entre 0.00 y 1,000,000.00 metros cuadrados y la superficie total entre 0.01 y 1,000,000.00 metros cuadrados',
  coeficientesNoRegistrados: 'La tabla maestra normativa no contiene coeficientes vigentes para superficie permeable (Cp) e impermeable (Ci)',

  // RF-WEB-05
  periodoInvalido: 'Seleccione una alcaldía válida y un período de retorno permitido',
  intensidadNoRegistrada: 'No existe una intensidad de lluvia registrada para la alcaldía y el período de retorno seleccionados',

  // RF-WEB-06
  parametrosIncompletos: 'Parámetros incompletos para el cálculo del caudal pico',
  parametrosFueraDeRango: 'Parámetros fuera de rango para el cálculo del caudal pico',

  // RF-WEB-07
  capacidadFueraDeRango: 'La capacidad de almacenamiento debe estar entre 0.01 y 50000.00 metros cúbicos',
  tipoObraFaltante: 'Seleccione un tipo de obra de mitigación pluvial',
  caudalFaltante: 'Debe calcular el caudal pico antes de simular la mitigación',
  obraSinUbicacion: 'Coloque la obra de mitigación en el mapa dentro de la zona afectada',
  obraFueraDeZona: 'La obra de mitigación debe colocarse dentro de la zona afectada',
  ubicacionActualizada: 'Ubicación del proyecto actualizada',
  cpNoRegistrado: 'La tabla maestra normativa no contiene un coeficiente vigente para superficie permeable (Cp)',
  dentroDeCapacidad: 'El caudal ajustado está dentro de la capacidad de descarga permitida',
  excedeCapacidad: 'El caudal ajustado excede la capacidad de descarga permitida',

  // RF-ADM-01
  adminLoginIncorrecto: 'Las credenciales o los privilegios de administrador son incorrectos',

  // RF-ADM-02
  accesoDenegado: 'Acceso denegado: se requiere rol de administrador',
  sinIncidencias: 'No hay incidencias registradas',
  incidenciaEliminada: 'La incidencia fue eliminada del mapa',
  incidenciaNoEncontrada: 'La incidencia seleccionada no existe',
  incidenciaAprobada: 'La incidencia fue aprobada y ya es visible en los mapas',
  incidenciaYaAprobada: 'La incidencia ya estaba aprobada',

  // Mensajes para los reportes ciudadanos.
  reporteIncidenciaInvalido: 'Seleccione el tipo de incidencia y el nivel del agua',
  descripcionLarga: 'La descripción admite hasta 200 caracteres',
  reporteRecibido: 'Reporte recibido. Aparecerá en el mapa cuando un administrador lo valide',
  demasiadosReportes: 'Se recibieron demasiados reportes desde esta conexión. Intente más tarde',
  reportesSaturados: 'Por el momento no se reciben más reportes. Intente más tarde',

  // RF-ADM-03
  parametroActualizado: 'El parámetro fue actualizado con éxito',
  valorFueraDeNorma: 'El valor está fuera de norma',
  valorNoNumerico: 'Ingrese un valor numérico con máximo dos decimales',

  // RF-ADM-04
  cuentaInvalida: 'El correo electrónico ya se encuentra registrado o los datos son inválidos',
  correoFallido: 'No fue posible enviar la contraseña temporal; la cuenta no fue creada',

  // RF-ADM-05
  busquedaLongitud: 'Ingrese entre 1 y 50 caracteres',
  sinUsuarios: 'No se encontraron usuarios con el criterio ingresado',

  // RF-ADM-06
  rolModificado: 'El rol de usuario fue modificado exitosamente',
  ultimoAdministrador: 'No es posible eliminar el último rol de administrador activo',
  rolIgual: 'El rol seleccionado es igual al rol actual de la cuenta',
  usuarioNoExiste: 'El usuario seleccionado no existe',
  administradorProtegido: 'El administrador inicial no puede cambiar de rol ni deshabilitarse',

  // RF-ADM-07
  cuentaPropia: 'No es posible desactivar la cuenta propia en uso',
  cuentaYaInactiva: 'La cuenta seleccionada ya se encuentra inactiva',
  cuentaDesactivada: 'La cuenta fue desactivada; ya no podrá iniciar sesión y su historial se conserva',

  // Mensajes para la reactivación de cuentas.
  cuentaYaActiva: 'La cuenta seleccionada ya se encuentra activa',
  cuentaReactivada: 'La cuenta fue reactivada; ya puede iniciar sesión con su contraseña y su historial',

  // Mensajes para la eliminación definitiva.
  cuentaEliminada: 'La cuenta y todos sus proyectos, simulaciones y reportes fueron eliminados definitivamente',
  cuentaActivaNoEliminable: 'Desactive la cuenta antes de eliminarla',
  cuentaPropiaNoEliminable: 'No es posible eliminar la cuenta propia en uso',
  administradorNoEliminable: 'El administrador inicial no puede eliminarse',
  proyectoEliminado: 'El proyecto fue eliminado junto con sus simulaciones y reportes',
  simulacionEliminada: 'La simulación fue eliminada del historial',
  simulacionNoEncontrada: 'La simulación seleccionada no existe',
  reporteEliminado: 'El reporte fue eliminado del historial',
  reporteNoEncontrado: 'El reporte seleccionado no existe',

  // RF-WEB-08
  reporteIncompleto: 'Debe completar todos los cálculos antes de exportar',
  reporteFallido: 'No fue posible generar el reporte técnico',

  // Mensajes para el cambio y la recuperación de contraseña.
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

  // Mensajes para la configuración del administrador inicial.
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

  // Mensajes para el equipo de ingenieros de un proyecto.
  soloCreador: 'Solo el creador del proyecto puede realizar esta acción',
  ingenieroNoEncontrado: 'No existe un ingeniero civil activo con ese correo',
  ingenieroYaMiembro: 'El ingeniero ya forma parte del proyecto',
  limiteMiembros: 'El proyecto alcanzó el máximo de 10 ingenieros invitados',
  miembroNoEncontrado: 'El ingeniero seleccionado no forma parte del proyecto',
  creadorNoSeQuita: 'El creador del proyecto no puede quitarse; puede eliminar el proyecto',
  miembroQuitado: 'El ingeniero ya no forma parte del proyecto',
  salioDelProyecto: 'Ya no forma parte del proyecto'
};

// Cantidad máxima de ingenieros invitados a un proyecto.
const MAXIMO_MIEMBROS = 10;

// Límites del semáforo según el caudal permitido.
const UMBRALES_SEMAFORO = { verde: 1.0, amarillo: 1.5 };

// Etiquetas y descripciones que corresponden a cada nivel del semáforo.
const NIVELES_SEMAFORO = {
  verde: { etiqueta: 'Riesgo bajo', descripcion: 'El caudal está dentro de la capacidad de descarga permitida.' },
  amarillo: { etiqueta: 'Riesgo medio', descripcion: 'El caudal excede hasta en 50 % la capacidad de descarga permitida; existe riesgo de encharcamiento.' },
  rojo: { etiqueta: 'Riesgo alto', descripcion: 'El caudal excede en más de 50 % la capacidad de descarga permitida; existe riesgo alto de encharcamiento o inundación.' }
};

// Altura de agua que se utiliza para calcular el área encharcada.
const LAMINA_ENCHARCAMIENTO = 0.05;

// Eficiencia mínima de la obra cuando está en el borde de la zona afectada.
const EFICIENCIA_EN_BORDE = 0.5;

// Tamaño máximo permitido para el reporte técnico en PDF.
const TAMANO_MAXIMO_REPORTE = 10 * 1024 * 1024;

// Función que redondea un número a la cantidad de decimales indicada.
function redondear(valor, decimales) {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

// Función que convierte el valor de un formulario en número.
function leerCantidad(valor) {
  if (valor === undefined || valor === null) return null;

  const texto = String(valor).trim();

  if (texto === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return NaN;

  return Number(texto);
}

// ---------- RF-WEB-01 y RF-ADM-01: credenciales ----------

// Función que comprueba si el correo tiene un formato válido.
function correoValido(correo) {
  return typeof correo === 'string' && correo.length >= 5 && correo.length <= 50
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Función que comprueba que el correo y la contraseña tengan el formato correcto.
function credencialesConFormatoValido(correo, contrasena) {
  return correoValido(correo) && typeof contrasena === 'string'
    && contrasena.length >= 8 && contrasena.length <= 16;
}

// ---------- RF-WEB-02: nombre del proyecto ----------

// Función que valida que el nombre tenga entre 1 y 100 caracteres.
function nombreProyectoValido(nombre) {
  if (typeof nombre !== 'string') return false;

  const largo = nombre.trim().length;

  return largo >= 1 && largo <= 100;
}

// ---------- RF-WEB-04: superficies y coeficiente ----------

// Función que valida las superficies y devuelve sus valores o un mensaje de error.
function validarSuperficies(permeable, impermeable) {
  const ap = leerCantidad(permeable);
  const ai = leerCantidad(impermeable);

  // Comprueba que las dos superficies tengan un valor.
  if (ap === null || ai === null) {
    return { error: MENSAJES.superficiesFaltantes };
  }

  // Comprueba que las superficies no superen el límite permitido.
  if (Number.isNaN(ap) || Number.isNaN(ai) || ap > 1000000 || ai > 1000000) {
    return { error: MENSAJES.superficiesFueraDeRango };
  }

  // Suma las superficies y redondea el resultado a dos decimales.
  const total = redondear(ap + ai, 2);

  // Comprueba que la superficie total esté dentro del rango.
  if (total < 0.01 || total > 1000000) {
    return { error: MENSAJES.superficiesFueraDeRango };
  }

  return { ap, ai, total };
}

// Función que calcula el coeficiente de escurrimiento.
function calcularCoeficiente(cp, ci, ap, ai) {
  return redondear((cp * ap + ci * ai) / (ap + ai), 2);
}

// ---------- RF-WEB-05: período de retorno ----------

// Función que comprueba si el período está en la lista permitida.
function periodoValido(periodo) {
  return PERIODOS_RETORNO.includes(Number(periodo));
}

// ---------- RF-WEB-06: caudal pico ----------

// Función que revisa si los parámetros del caudal están completos y dentro del rango.
function validarParametrosCaudal(coeficiente, intensidad, superficieTotal) {
  if (coeficiente == null || intensidad == null || superficieTotal == null) {
    return MENSAJES.parametrosIncompletos;
  }

  // Comprueba los límites permitidos para cada parámetro.
  const fueraDeRango = coeficiente < 0.05 || coeficiente > 0.95
    || intensidad < 10 || intensidad > 250
    || superficieTotal < 0.01 || superficieTotal > 1000000;

  return fueraDeRango ? MENSAJES.parametrosFueraDeRango : null;
}

// Función que calcula el caudal pico con el Método Racional.
function calcularCaudalPico(coeficiente, intensidad, superficieM2) {
  // Convierte la superficie de metros cuadrados a hectáreas.
  const hectareas = superficieM2 / 10000;

  // Calcula el caudal y lo redondea a tres decimales.
  return redondear((coeficiente * intensidad * hectareas) / 360, 3);
}

// ---------- RF-WEB-07: obra de mitigación ----------

// Función que comprueba si el tipo de obra está en el catálogo.
function tipoObraValido(tipo) {
  return TIPOS_OBRA.includes(tipo);
}

// Función que valida la capacidad de almacenamiento.
function leerCapacidad(valor) {
  const capacidad = leerCantidad(valor);

  if (capacidad === null || Number.isNaN(capacidad)) return null;
  if (capacidad < 0.01 || capacidad > 50000) return null;

  return capacidad;
}

// Función que calcula el efecto de la obra sobre el caudal pico.
function simularMitigacion({ caudalPico, capacidad, cp, intensidad, superficieM2, eficiencia = 1 }) {
  // Calcula cuánto caudal puede retener la obra por segundo.
  const retencion = redondear((capacidad / 3600) * eficiencia, 6);

  // Resta la retención al caudal pico; el resultado no puede ser negativo.
  const caudalAjustado = Math.max(0, redondear(caudalPico - retencion, 3));

  // Calcula el caudal permitido para comparar los resultados.
  const caudalPermitido = calcularCaudalPico(cp, intensidad, superficieM2);

  // Comprueba si el caudal ajustado está dentro del límite permitido.
  const dentroDeCapacidad = caudalAjustado <= caudalPermitido;

  return {
    retencion,
    caudalAjustado,
    caudalPermitido,
    dentroDeCapacidad,
    mensaje: dentroDeCapacidad ? MENSAJES.dentroDeCapacidad : MENSAJES.excedeCapacidad
  };
}

// ---------- Ubicación del proyecto ----------

// Función que valida que las coordenadas estén dentro de los rangos permitidos.
function coordenadasValidas(latitud, longitud) {
  const lat = Number(latitud);
  const lng = Number(longitud);

  return latitud !== null && longitud !== null && latitud !== '' && longitud !== ''
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ---------- Semáforo de impacto pluvial ----------

// Función que calcula los límites de caudal para los niveles verde y amarillo.
function limitesSemaforo(caudalPermitido) {
  return {
    verde: redondear(caudalPermitido * UMBRALES_SEMAFORO.verde, 3),
    amarillo: redondear(caudalPermitido * UMBRALES_SEMAFORO.amarillo, 3)
  };
}

// Función que identifica el nivel de riesgo según el caudal.
function evaluarSemaforo(caudal, caudalPermitido) {
  const limites = limitesSemaforo(caudalPermitido);

  let nivel;

  // Compara el caudal con los límites para asignar un nivel.
  if (caudal <= limites.verde) {
    nivel = 'verde';
  } else if (caudalPermitido > 0 && caudal <= limites.amarillo) {
    nivel = 'amarillo';
  } else {
    nivel = 'rojo';
  }

  // Calcula qué porcentaje representa el caudal respecto al permitido.
  const porcentaje = caudalPermitido > 0 ? Math.round((caudal / caudalPermitido) * 100) : null;

  return { nivel, porcentaje, ...NIVELES_SEMAFORO[nivel] };
}

// Función que calcula la capacidad necesaria para alcanzar un caudal objetivo.
function capacidadNecesaria(caudalPico, caudalObjetivo, eficiencia = 1) {
  // Calcula la capacidad y redondea hacia arriba a dos decimales.
  const capacidad = Math.ceil(((caudalPico - caudalObjetivo) * 3600 / eficiencia - 1e-9) * 100) / 100;

  return Math.max(0, capacidad);
}

// ---------- Zona afectada y ubicación de la obra ----------

// Función que calcula la distancia entre dos coordenadas usando Haversine.
function distanciaMetros(lat1, lng1, lat2, lng2) {
  // Convierte los grados a radianes.
  const radianes = (g) => (g * Math.PI) / 180;

  const dLat = radianes(lat2 - lat1);
  const dLng = radianes(lng2 - lng1);

  // Calcula la distancia considerando la curvatura de la Tierra.
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radianes(lat1)) * Math.cos(radianes(lat2)) * Math.sin(dLng / 2) ** 2;

  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Función que calcula el volumen que excede la descarga permitida durante una hora.
function volumenExcedente(caudal, caudalPermitido) {
  return redondear(Math.max(0, caudal - caudalPermitido) * 3600, 2);
}

// Función que calcula el radio de la zona afectada.
function radioAfectacion(superficieM2, caudal, caudalPermitido) {
  // Calcula el área encharcada usando el volumen excedente y la lámina de agua.
  const areaEncharcada = volumenExcedente(caudal, caudalPermitido) / LAMINA_ENCHARCAMIENTO;

  // Calcula el radio de un círculo con el área total.
  return redondear(Math.sqrt((superficieM2 + areaEncharcada) / Math.PI), 1);
}

// Función que calcula el radio del predio como un círculo.
function radioPredio(superficieM2) {
  return redondear(Math.sqrt(superficieM2 / Math.PI), 1);
}

// Función que calcula el área total de la zona afectada.
function areaZonaAfectada(superficieM2, caudal, caudalPermitido) {
  return redondear(superficieM2 + volumenExcedente(caudal, caudalPermitido) / LAMINA_ENCHARCAMIENTO, 2);
}

// Función que comprueba si una simulación sigue correspondiendo al proyecto actual.
function simulacionVigente(simulacion, proyecto, caudalPermitido) {
  // Comprueba que existan los datos necesarios.
  if (!simulacion || proyecto.caudalPico == null || simulacion.caudalPico == null) return false;

  // Calcula la distancia entre la ubicación actual y la guardada.
  const distanciaActual = distanciaMetros(proyecto.latitud, proyecto.longitud, simulacion.latitud, simulacion.longitud);

  // Compara los caudales y la ubicación para comprobar si sigue vigente.
  return simulacion.caudalPico === proyecto.caudalPico
    && simulacion.caudalPermitido === caudalPermitido
    && Math.abs(distanciaActual - simulacion.distancia) <= 1;
}

// Función que calcula la eficiencia de una obra según su distancia al proyecto.
function eficienciaPorUbicacion(distancia, radio) {
  if (!(radio > 0) || distancia > radio) return null;

  // Reduce la eficiencia conforme la obra se aleja del proyecto.
  return redondear(1 - (1 - EFICIENCIA_EN_BORDE) * (distancia / radio), 3);
}

// Función que calcula a qué distancia se obtiene una eficiencia determinada.
function distanciaParaEficiencia(eficiencia, radio) {
  return redondear(radio * (1 - eficiencia) / (1 - EFICIENCIA_EN_BORDE), 1);
}

// ---------- RF-ADM-03: tabla maestra ----------

// Función que valida un parámetro y devuelve su valor o un mensaje de error.
function validarValorParametro(tipo, texto) {
  const limpio = String(texto ?? '').trim();

  // Comprueba que el valor sea numérico y tenga máximo dos decimales.
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) return { error: MENSAJES.valorNoNumerico };

  const valor = Number(limpio);

  // Aplica el rango correspondiente al tipo de parámetro.
  const enRango = tipo === 'intensidad'
    ? valor >= 10 && valor <= 250
    : valor >= 0.05 && valor <= 0.95;

  return enRango ? { valor } : { error: MENSAJES.valorFueraDeNorma };
}

// ---------- RF-ADM-04: datos de una cuenta nueva ----------

// Función que valida el nombre, correo y rol de una cuenta.
function datosCuentaValidos(nombre, correo, rol) {
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';

  return nombreLimpio.length >= 1 && nombreLimpio.length <= 100
    && correoValido(typeof correo === 'string' ? correo.trim() : '')
    && ROLES.includes(rol);
}

// Función que genera una contraseña temporal de 12 caracteres.
function generarContrasenaTemporal(obtenerAleatorios) {
  // Grupos de caracteres que se pueden utilizar.
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '#$%&*+?'];

  const todos = grupos.join('');
  const aleatorios = obtenerAleatorios(12);

  // Genera los caracteres usando los valores aleatorios recibidos.
  const caracteres = aleatorios.map((n, i) => (i < grupos.length ? grupos[i] : todos)[n % (i < grupos.length ? grupos[i] : todos).length]);

  // Mezcla los caracteres para cambiar su orden.
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = aleatorios[(i + 3) % aleatorios.length] % (i + 1);

    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }

  return caracteres.join('');
}

// ---------- Cambio y recuperación de contraseña ----------

// Tiempo de vigencia del código e intentos permitidos.
const MINUTOS_VIGENCIA_CODIGO = 15;
const INTENTOS_MAXIMOS_CODIGO = 5;

// Función que comprueba que la contraseña cumpla los requisitos.
function contrasenaSegura(contrasena) {
  const texto = String(contrasena ?? '');

  return texto.length >= 8 && texto.length <= 16 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(texto) && /\d/.test(texto);
}

// Función que valida la contraseña nueva y su confirmación.
function validarNuevaContrasena(nueva, confirmacion, actual = null) {
  if (!contrasenaSegura(nueva)) return MENSAJES.contrasenaNuevaInvalida;
  if (nueva !== confirmacion) return MENSAJES.contrasenaNoCoincide;
  if (actual !== null && nueva === actual) return MENSAJES.contrasenaRepetida;

  return null;
}

// Función que genera un código de recuperación de seis dígitos.
function generarCodigoRecuperacion(obtenerAleatorios) {
  return obtenerAleatorios(6).map((n) => n % 10).join('');
}

// Función que comprueba que el código tenga exactamente seis dígitos.
function codigoRecuperacionValido(codigo) {
  return /^\d{6}$/.test(String(codigo ?? '').trim());
}

// ---------- Reporte ciudadano de incidencias ----------

// Tipos de incidencias que puede seleccionar el ciudadano.
const TIPOS_INCIDENCIA = ['Encharcamiento', 'Inundación', 'Coladera obstruida'];

// Niveles de agua disponibles.
const NIVELES_AGUA = ['Bajo', 'Medio', 'Alto'];   // Bajo: tobillo, medio: rodilla, alto: arriba de la rodilla

// Máximo de caracteres permitidos en la descripción.
const LARGO_MAXIMO_DESCRIPCION = 200;

// Valida el tipo, nivel de agua y longitud de la descripción.
function validarReporteIncidencia(tipo, nivelAgua, descripcion) {
  if (!TIPOS_INCIDENCIA.includes(tipo) || !NIVELES_AGUA.includes(nivelAgua)) return MENSAJES.reporteIncidenciaInvalido;
  if (String(descripcion ?? '').trim().length > LARGO_MAXIMO_DESCRIPCION) return MENSAJES.descripcionLarga;
  return null;
}

// Verifica que el identificador sea un entero dentro del rango permitido.
function identificadorValido(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= 2147483647;
}

// ---------- RF-ADM-05: búsqueda de usuarios ----------

// Verifica que la búsqueda tenga entre 1 y 50 caracteres.
function busquedaValida(texto) {
  return typeof texto === 'string' && texto.length >= 1 && texto.length <= 50;
}

// Busca coincidencias en nombre, correo o rol, ignorando mayúsculas y acentos.
function usuarioCoincide(usuario, texto) {
  const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const buscado = normalizar(texto.trim());
  return [usuario.nombre, usuario.correo, usuario.rol].some((campo) => normalizar(campo).includes(buscado));
}

// ---------- RF-WEB-08: reporte técnico ----------

// Comprueba que el proyecto tenga todos los datos necesarios para el reporte.
function datosCompletosParaReporte(proyecto) {
  return Boolean(proyecto)
    && Boolean(proyecto.nombre)
    && Boolean(proyecto.idAlcaldia)
    && proyecto.superficiePermeable != null
    && proyecto.superficieImpermeable != null
    && proyecto.superficieTotal != null
    && proyecto.coeficiente != null
    && proyecto.intensidad != null
    && proyecto.periodoRetorno != null
    && proyecto.caudalPico != null
    && proyecto.latitud != null
    && proyecto.longitud != null;
}

// Exporta las funciones para utilizarlas en Node.js y en las pruebas.
if (typeof module !== 'undefined') {
  module.exports = {
    PERIODOS_RETORNO, TIPOS_OBRA, MENSAJES, MAXIMO_MIEMBROS, ROL_INGENIERO, ROL_ADMINISTRADOR, ROLES,
    correoValido, validarValorParametro, datosCuentaValidos, generarContrasenaTemporal,
    MINUTOS_VIGENCIA_CODIGO, INTENTOS_MAXIMOS_CODIGO, contrasenaSegura, validarNuevaContrasena,
    generarCodigoRecuperacion, codigoRecuperacionValido, identificadorValido,
    TIPOS_INCIDENCIA, NIVELES_AGUA, validarReporteIncidencia, busquedaValida, usuarioCoincide, TAMANO_MAXIMO_REPORTE, UMBRALES_SEMAFORO, NIVELES_SEMAFORO,
    coordenadasValidas, limitesSemaforo, evaluarSemaforo, capacidadNecesaria,
    LAMINA_ENCHARCAMIENTO, distanciaMetros, volumenExcedente, radioAfectacion, eficienciaPorUbicacion,
    distanciaParaEficiencia,
    radioPredio, areaZonaAfectada, simulacionVigente,
    redondear, leerCantidad, credencialesConFormatoValido, nombreProyectoValido,
    validarSuperficies, calcularCoeficiente, periodoValido, validarParametrosCaudal,
    calcularCaudalPico, tipoObraValido, leerCapacidad, simularMitigacion, datosCompletosParaReporte
  };
}