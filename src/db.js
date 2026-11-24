// un Pool reutiliza hasta 5 conexiones abiertas; con Supabase la conexión va cifrada (SSL). SSL es el cifrado de la conexión con la base de datos, que protege los datos mientras viajan por Internet.
// No utilizar SSL  en Supabase es un riesgo de seguridad, porque la contraseña y los datos viajan sin cifrar. Solo se puede desactivar SSL en una base local (localhost)
// Por qué no abrir una conexión por consulta: es lento y Supabase gratuito permite pocas conexiones.
// Conexión a PostgreSQL (Supabase) mediante un pool de conexiones del paquete pg.
// La dirección de la base se lee de DATABASE_URL.
// Primero se cargan las variables del .env, porque aquí se usa DATABASE_URL.
require('./entorno'); // Aqui se carga el .env
const fs = require('fs'); // fs es el módulo de Node.js para leer archivos (para leer el certificado de la base).
const { Pool, types } = require('pg'); //  pg es el paquete de Node.js para conectarse a PostgreSQL. Pool es un grupo de conexiones que se reutilizan; types permite cambiar la conversión de tipos de PostgreSQL a JavaScript.
// Por ejemplo, PostgreSQL devuelve los números como texto; aquí se convierten a number de JavaScript. Esto evita que se tenga que convertir cada número en cada consulta.

types.setTypeParser(1700, (valor) => parseFloat(valor));     // NUMERIC   → number
types.setTypeParser(20, (valor) => parseInt(valor, 10));     // BIGINT    → number (resultados de COUNT)
types.setTypeParser(1082, (valor) => valor);                 // DATE      → 'YYYY-MM-DD'
types.setTypeParser(1114, (valor) => valor);                 // TIMESTAMP → 'YYYY-MM-DD HH:MM:SS'

// Dirección de una base en la propia computadora; se usa si no existe DATABASE_URL para ejecutar en un entorno local (desarrollo).
const URL_LOCAL = 'postgresql://postgres@localhost:5432/sehip';
const direccion = new URL(process.env.DATABASE_URL || URL_LOCAL); // dirección es un objeto URL que permite leer el host, puerto, usuario, contraseña y base de datos de la dirección de la base.
// Una base local no necesita conexión cifrada.
const esLocal = ['localhost', '127.0.0.1'].includes(direccion.hostname);

// Se quita aqui ssl de la dirección porque el ssl se configura en el pool de conexiones. Si se deja en la dirección, el pool no puede conectarse a la base.
// Quien decide si se usa o no ssl es configuracion Ssl()
direccion.searchParams.delete('sslmode');

// Conexión cifrada con TLS (TLS es un SSL moderno, en la práctica es lo mismo, solo se conserva el nombre SSL pero quien corre por debajo es TLS). Se puede configurar de tres maneras:
//   - BD_SSL=desactivado          → sin cifrado (solo para una base en la propia computadora).
//   - BD_CERTIFICADO_CA=<archivo> → cifrado y verificación del certificado del servidor (recomendado).
//   - en otro caso                → cifrado sin verificar el certificado.
function configuracionSsl() { // Esta funcion devuelve la configuración de SSL para el pool de conexiones. Se puede desactivar SSL solo en una base local (localhost). Si se activa, se puede usar un certificado CA para verificar el certificado del servidor.
  if (process.env.BD_SSL === 'desactivado' || (esLocal && !process.env.BD_SSL)) return false;
  if (process.env.BD_CERTIFICADO_CA) {
    return { ca: fs.readFileSync(process.env.BD_CERTIFICADO_CA, 'utf8'), rejectUnauthorized: true }; // Esto devuelve un objeto con la propiedad ca que contiene el certificado CA y rejectUnauthorized en true para verificar el certificado del servidor. El certificado CA se lee del archivo indicado en la variable de entorno BD_CERTIFICADO_CA.
  }
  return { rejectUnauthorized: false }; // devuelve un objeto con rejectUnauthorized en false para cifrar la conexión pero sin verificar el certificado del servidor.
}

// Pool de máximo 5 conexiones (el plan gratuito de Supabase permite pocas) que espera 10 segundos
// para conectarse antes de marcar error.
const pool = new Pool({
  connectionString: direccion.toString(),
  ssl: configuracionSsl(),
  max: 5,
  connectionTimeoutMillis: 10000 // 10 segundos
});

// Un error en una conexión inactiva (por ejemplo, la base se reinició) no detiene el servidor.
pool.on('error', (error) => console.error('Error en la conexión con PostgreSQL:', error.message));

// Todos los archivos del servidor usan este mismo pool con db.query(texto, parámetros).
module.exports = pool;
