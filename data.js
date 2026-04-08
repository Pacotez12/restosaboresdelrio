// ============ DATOS ============
const MENU = [
  // Entradas del río y mar
  { id:1,  nombre:'Ceviche de Surubí', precio:52000, cat:'Entradas', emoji:'🍋' },
  { id:2,  nombre:'Empanadas de Mariscos', precio:38000, cat:'Entradas', emoji:'🦐' },
  { id:3,  nombre:'Carpaccio de Pacú', precio:48000, cat:'Entradas', emoji:'🐟' },
  { id:4,  nombre:'Mejillones al Ajillo', precio:44000, cat:'Entradas', emoji:'🦪' },
  // Pescados de río
  { id:5,  nombre:'Surubí a la Plancha', precio:78000, cat:'Pescados de Río', emoji:'🐠' },
  { id:6,  nombre:'Pacú Entero Asado', precio:85000, cat:'Pescados de Río', emoji:'🔥' },
  { id:7,  nombre:'Dorado al Limón', precio:90000, cat:'Pescados de Río', emoji:'🍊' },
  { id:8,  nombre:'Tararira en Salsa Verde', precio:72000, cat:'Pescados de Río', emoji:'🌿' },
  { id:9,  nombre:'Boga a la Parrilla', precio:68000, cat:'Pescados de Río', emoji:'🐡' },
  // Mariscos y mar
  { id:10, nombre:'Camarones al Pil Pil', precio:82000, cat:'Mariscos', emoji:'🦐' },
  { id:11, nombre:'Pulpo a la Gallega', precio:95000, cat:'Mariscos', emoji:'🐙' },
  { id:12, nombre:'Cazuela de Mariscos', precio:98000, cat:'Mariscos', emoji:'🍲' },
  { id:13, nombre:'Langostinos a la Manteca', precio:88000, cat:'Mariscos', emoji:'🦞' },
  // Pastas y arroces
  { id:14, nombre:'Risotto de Camarones', precio:65000, cat:'Arroces & Pastas', emoji:'🍚' },
  { id:15, nombre:'Fideos Negros con Calamar', precio:62000, cat:'Arroces & Pastas', emoji:'🦑' },
  { id:16, nombre:'Arroz con Mariscos', precio:70000, cat:'Arroces & Pastas', emoji:'🥘' },
  // Postres
  { id:17, nombre:'Mousse de Maracuyá', precio:28000, cat:'Postres', emoji:'🍮' },
  { id:18, nombre:'Tarta de Coco y Limón', precio:26000, cat:'Postres', emoji:'🥥' },
  // Bebidas
  { id:19, nombre:'Limonada de Jengibre', precio:18000, cat:'Bebidas', emoji:'🍋' },
  { id:20, nombre:'Tereré de Hierbas', precio:12000, cat:'Bebidas', emoji:'🧉' },
  { id:21, nombre:'Vino Blanco Copa', precio:32000, cat:'Bebidas', emoji:'🥂' },
  { id:22, nombre:'Agua de Coco Natural', precio:16000, cat:'Bebidas', emoji:'🥤' },
];

const CATEGORIAS = ['Todas', ...new Set(MENU.map(i => i.cat))];

const MESAS_INITIAL = [
  { num:1, estado:'libre', personas:0 },
  { num:2, estado:'ocupada', personas:3 },
  { num:3, estado:'libre', personas:0 },
  { num:4, estado:'ocupada', personas:2 },
  { num:5, estado:'libre', personas:0 },
  { num:6, estado:'ocupada', personas:5 },
  { num:7, estado:'libre', personas:0 },
  { num:8, estado:'libre', personas:0 },
  { num:9, estado:'ocupada', personas:4 },
  { num:10, estado:'libre', personas:0 },
];

const MESA_ICONS = ['⛵','🚣','🎣','🐚','🌊','⚓','🦈','🐋','🪝','🗺️'];

const ventasDemo = {
  hoy:    { total:2100000,  pedidos:38,  ticket:55263,  mesa_avg:52, horas:[60,90,180,300,480,640,610,490,370,280,200,150,100], cats:[{n:'Pescados de Río',p:38},{n:'Mariscos',p:28},{n:'Bebidas',p:14},{n:'Arroces & Pastas',p:12},{n:'Otros',p:8}] },
  semana: { total:13500000, pedidos:224, ticket:60268,  mesa_avg:51, horas:[300,550,900,1400,1900,2400,2200,1900,1500,1100,800,600,400], cats:[{n:'Pescados de Río',p:36},{n:'Mariscos',p:30},{n:'Bebidas',p:13},{n:'Arroces & Pastas',p:14},{n:'Otros',p:7}] },
  mes:    { total:54000000, pedidos:880, ticket:61364,  mesa_avg:49, horas:[1200,2000,3400,5200,7000,8600,8000,6800,5000,3800,2800,2000,1400], cats:[{n:'Pescados de Río',p:35},{n:'Mariscos',p:31},{n:'Bebidas',p:12},{n:'Arroces & Pastas',p:14},{n:'Otros',p:8}] },
};
