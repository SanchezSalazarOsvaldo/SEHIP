// Inicia el servidor y organiza las rutas.
const path = require('path');
const express = require('express');
const session = require('express-session');

const db = require('./db');
const AlmacenSesiones = require('./almacen-sesiones');
const { modoCorreo } = require('./correo');
const { MENSAJES } = require('../public/js/validaciones');
const { limiteGeneral, limiteEscrituraPorUsuario } = require('./limites');

const { router: rutasAuth } = require('./rutas/auth');
const rutasCuenta = require('./rutas/cuenta');
const rutasProyectos = require('./rutas/proyectos');
const rutasAdmin = require('./rutas/admin');
const rutasPublico = require('./rutas/publico');


const PUERTO = Number(process.env.PORT || process.env.PUERTO || 3000);

const EN_PRODUCCION = process.env.NODE_ENV === 'production';

const app = express();


app.disable('x-powered-by');



if (EN_PRODUCCION) app.set('trust proxy', 1);


// Aplica esta comprobación antes de continuar.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');       
  res.setHeader('X-Frame-Options', 'DENY');                 
  res.setHeader('Referrer-Policy', 'same-origin');
  if (EN_PRODUCCION) {
    
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
});


// Aplica esta comprobación antes de continuar.
app.use((req, res, next) => {
  if (EN_PRODUCCION && req.get('x-forwarded-proto') === 'http') {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
});



// Aplica esta comprobación antes de continuar.
app.use('/api', limiteGeneral);




const jsonNormal = express.json({ limit: '100kb' });
const jsonReporte = express.json({ limit: '15mb' });
// Aplica esta comprobación antes de continuar.
app.use((req, res, next) => {
  const esReporte = /^\/api\/proyectos\/[^/]+\/reportes$/.test(req.path);
  return esReporte ? jsonReporte(req, res, next) : jsonNormal(req, res, next);
});



// Aplica esta comprobación antes de continuar.
app.use(session({
  store: new AlmacenSesiones(),
  secret: process.env.SESION_SECRETO || 'sehip-clave-de-sesion',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: EN_PRODUCCION, maxAge: 8 * 60 * 60 * 1000 }
}));


// Configura una parte del servidor.
app.get('/api/salud', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ estado: 'ok' });
});


// Aplica esta comprobación antes de continuar.
app.use(express.static(path.join(__dirname, '..', 'public')));


// Aplica esta comprobación antes de continuar.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.session.usuario) return limiteEscrituraPorUsuario(req, res, next);
  next();
});



// Aplica esta comprobación antes de continuar.
app.use('/api/publico', rutasPublico);
// Aplica esta comprobación antes de continuar.
app.use('/api/admin', rutasAdmin);
// Aplica esta comprobación antes de continuar.
app.use('/api', rutasAuth);
// Aplica esta comprobación antes de continuar.
app.use('/api', rutasCuenta);
// Aplica esta comprobación antes de continuar.
app.use('/api', rutasProyectos);


// Aplica esta comprobación antes de continuar.
app.use('/api', (req, res) => res.status(404).json({ error: MENSAJES.rutaNoEncontrada }));




// Aplica esta comprobación antes de continuar.
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: MENSAJES.solicitudMuyGrande });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: MENSAJES.solicitudInvalida });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error al procesar la solicitud. Intente de nuevo.' });
});


process.on('unhandledRejection', (error) => console.error('Promesa rechazada sin manejar:', error));


db.query('SELECT 1')
  .then(() => {
    
    
    const servidor = app.listen(PUERTO, () => {
      console.log(`SEHIP en ejecución en el puerto ${PUERTO}${EN_PRODUCCION ? ' (producción)' : ''}`);
      console.log(`Envío de correo: ${modoCorreo()}`);
    });
    
    
    servidor.headersTimeout = 15000;
    servidor.requestTimeout = 60000;
  })
  .catch((err) => {
    console.error('No fue posible conectar con PostgreSQL:', err.message);
    process.exit(1);
  });
