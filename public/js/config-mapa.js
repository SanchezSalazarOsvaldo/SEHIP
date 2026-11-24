// Se guardan los límites de las 16 alcaldías para comprobar la ubicación sin tener que consultar al servidor.
// Se usa el método de lanzar un rayo para saber si un punto está dentro o fuera de un polígono.
// No se guardan los polígonos en la base de datos porque son datos que no cambian y también se necesitan cuando no hay internet.
// Se agregan varios proveedores de mapas para tener otra opción si alguno deja de funcionar.

// Configuración del mapa que utiliza Leaflet.
// Leaflet es gratuito y no necesita una API key.
// Los mapas se cargan mediante imágenes llamadas teselas.
// Si un proveedor no responde, se intenta utilizar el siguiente.

// Proveedores de mapas ordenados según la prioridad con la que se intentan cargar.
const PROVEEDORES_MAPA = [
  {
    nombre: 'Calles (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    opciones: { attribution: 'Tiles &copy; Esri', maxZoom: 18 }
  },
  {
    nombre: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opciones: { attribution: '&copy; OpenStreetMap', maxZoom: 18 }
  },
  {
    nombre: 'Satélite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opciones: { attribution: 'Tiles &copy; Esri', maxZoom: 18 }
  }
];

// Cantidad de teselas que deben fallar para intentar cargar otro proveedor de mapas.
const ERRORES_PARA_CAMBIAR_MAPA = 4;