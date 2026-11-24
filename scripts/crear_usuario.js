// permite crear el administrador inicial o una cuenta sin entrar al sistema, con la contraseña cifrada con bcrypt.
// Por qué no insertar la cuenta con SQL a mano: habría que calcular el hash bcrypt fuera del sistema.
// Alta de cuentas desde la terminal.
// Uso:
//   node scripts/crear_usuario.js admin     "Nombre completo" correo@dominio.com Contrasena123
//   node scripts/crear_usuario.js ingeniero "Nombre completo" correo@dominio.com Contrasena123
// El tipo "admin" crea al Administrador del Sistema inicial protegido (solo puede existir uno).
// Alternativa a la configuración inicial de admin.html; las cuentas creadas aquí no piden cambio de contraseña.
// Los datos de conexión se toman del archivo .env (por medio de src/db.js).
// bcrypt cifra la contraseña, db conecta con la base y la validación revisa el formato del correo.
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { credencialesConFormatoValido } = require('../public/js/validaciones');

// Los dos tipos de cuenta que acepta el script y el rol que corresponde a cada uno.
const TIPOS = {
  admin: { rol: 'Administrador del Sistema', protegido: true },
  ingeniero: { rol: 'Ingeniero Civil', protegido: false }
};

// Lee los argumentos de la terminal, los valida y crea la cuenta.
async function main() { // Funcion asincrona para poder usar await con bcrypt y db.query
    // await es una palabra reservada que se usa para esperar a que una promesa se resuelva. bcrypt.hash y db.query devuelven promesas, por eso se usa await.
  const [tipo, nombre, correo, contrasena] = process.argv.slice(2); // process.argv es un array con los argumentos de la terminal; slice(2) quita los dos primeros (node y el script). Se desestructura en las variables tipo, nombre, correo y contrasena.
  const config = TIPOS[tipo];

  if (!config || !nombre || !correo || !contrasena) {
    console.log('Uso: node scripts/crear_usuario.js <admin|ingeniero> "Nombre completo" correo contrasena');
    process.exitCode = 1;
    return;
  }
  if (nombre.trim().length < 1 || nombre.trim().length > 100) {
    console.log('El nombre debe tener entre 1 y 100 caracteres.');
    process.exitCode = 1;
    return;
  }
  if (!credencialesConFormatoValido(correo, contrasena)) {
    console.log('El correo debe tener formato usuario@dominio.com (5 a 50 caracteres) y la contraseña de 8 a 16 caracteres.');
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(contrasena, 10);
  // bcrypt.hash cifra la contraseña con 10 rondas de sal (salt) y devuelve una promesa que se resuelve con el hash. Se usa await para esperar a que se resuelva la promesa y obtener el hash.
  // se usa $1, $2, $3 y $4 para evitar inyección SQL; los valores se pasan en el array al final de db.query.
  await db.query(
    `WITH nueva AS (
       INSERT INTO usuario (nombre, correo, contrasena_hash, id_rol)
       VALUES ($1, $2, $3, (SELECT id_rol FROM rol WHERE nombre = $4)) 
       RETURNING id_usuario
     ), protegida AS (
       INSERT INTO administrador_inicial (id_usuario) SELECT id_usuario FROM nueva WHERE $5
     )
     SELECT id_usuario FROM nueva`,
    [nombre.trim(), correo, hash, config.rol, config.protegido]
  );
  console.log(`Cuenta creada: ${correo} (${config.rol}${config.protegido ? ', administrador inicial protegido' : ''}).`);
}

// Ejecuta el script, explica el error si lo hubo y cierra la conexión con la base al final.
main()
  .catch((err) => {
    // 23505: correo repetido o segundo administrador inicial. P0001: regla de un trigger.
    if (err.code === '23505' && err.constraint === 'uq_un_administrador_inicial') {
      console.log('Ya existe un administrador inicial; cree las demás cuentas desde el panel.');
    } else if (err.code === '23505') {
      console.log('Ya existe una cuenta registrada con ese correo.');
    } else if (err.code === 'P0001') {
      console.log(err.message);
    } else {
      console.error('Error al crear la cuenta:', err.message);
    }
    process.exitCode = 1;
  })
  .finally(() => db.end());
