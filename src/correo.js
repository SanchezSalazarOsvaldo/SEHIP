// Envia correos de cuentas y recuperación.
require('./entorno');

const fs = require('fs');
const path = require('path');


const CARPETA_CORREOS = path.join(__dirname, '..', 'correos_enviados');
const TIEMPO_MAXIMO_MS = 5000; 



// Elige el medio usado para enviar correo.
function modoCorreo() {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.SMTP_USUARIO && process.env.SMTP_CONTRASENA) return 'smtp';
  return 'archivo';
}


// Obtiene la dirección que envia los mensajes.
function remitente() {
  return process.env.CORREO_REMITENTE || process.env.SMTP_USUARIO || 'no-responder@sehip.mx';
}



// Forma la fecha usada en el nombre del correo.
function marcaDeTiempo() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}


// Envia el correo con Brevo.
async function enviarConBrevo({ para, asunto, texto }) {
  const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'SEHIP', email: remitente() },
      to: [{ email: para }],
      subject: asunto,
      textContent: texto
    }),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
  });
  
  
  if (!respuesta.ok) {
    throw new Error(`Brevo respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
}



// Envia el correo con SMTP.
async function enviarConSmtp({ para, asunto, texto }) {
  
  const nodemailer = require('nodemailer');
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PUERTO || 465),
    secure: Number(process.env.SMTP_PUERTO || 465) === 465,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CONTRASENA },
    connectionTimeout: TIEMPO_MAXIMO_MS
  });
  await transporte.sendMail({ from: `SEHIP <${remitente()}>`, to: para, subject: asunto, text: texto });
}


// Guarda el correo en un archivo local.
function guardarEnArchivo({ para, asunto, texto }) {
  fs.mkdirSync(CARPETA_CORREOS, { recursive: true });
  const fecha = marcaDeTiempo();
  const archivo = `${fecha.replace(/[: ]/g, '-')}_${para.replace(/[^\w.@-]/g, '_')}.txt`;
  fs.writeFileSync(
    path.join(CARPETA_CORREOS, archivo),
    `De: ${remitente()}\nPara: ${para}\nFecha: ${fecha}\nAsunto: ${asunto}\n\n${texto}\n`
  );
}


// Envia el correo con el medio disponible.
async function enviarCorreo(mensaje) {
  const modo = modoCorreo();
  if (modo === 'brevo') return enviarConBrevo(mensaje);
  if (modo === 'smtp') return enviarConSmtp(mensaje);
  return guardarEnArchivo(mensaje);
}


module.exports = { enviarCorreo, modoCorreo };
