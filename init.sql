-- Creación de tablas para Sabores del Río

-- Categorías del menú
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

-- Ítems del menú
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio INTEGER NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id),
    emoji VARCHAR(10)
);

-- Mesas del restaurante
CREATE TABLE IF NOT EXISTS mesas (
    num INTEGER PRIMARY KEY,
    estado VARCHAR(20) DEFAULT 'libre',
    personas INTEGER DEFAULT 0
);

-- Pedidos (Tickets)
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    mesa_num INTEGER REFERENCES mesas(num),
    notas TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ítems dentro de un pedido
CREATE TABLE IF NOT EXISTS pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL,
    precio_unitario INTEGER NOT NULL
);

-- Datos iniciales (Categorías)
INSERT INTO categorias (nombre) VALUES 
('Entradas'), ('Pescados de Río'), ('Mariscos'), ('Arroces & Pastas'), ('Postres'), ('Bebidas')
ON CONFLICT (nombre) DO NOTHING;

-- Datos iniciales (Menú)
INSERT INTO menu_items (nombre, precio, categoria_id, emoji) VALUES
('Ceviche de Surubí', 52000, (SELECT id FROM categorias WHERE nombre='Entradas'), '🍋'),
('Empanadas de Mariscos', 38000, (SELECT id FROM categorias WHERE nombre='Entradas'), '🦐'),
('Carpaccio de Pacú', 48000, (SELECT id FROM categorias WHERE nombre='Entradas'), '🐟'),
('Mejillones al Ajillo', 44000, (SELECT id FROM categorias WHERE nombre='Entradas'), '🦪'),
('Surubí a la Plancha', 78000, (SELECT id FROM categorias WHERE nombre='Pescados de Río'), '🐠'),
('Pacú Entero Asado', 85000, (SELECT id FROM categorias WHERE nombre='Pescados de Río'), '🔥'),
('Dorado al Limón', 90000, (SELECT id FROM categorias WHERE nombre='Pescados de Río'), '🍊'),
('Tararira en Salsa Verde', 72000, (SELECT id FROM categorias WHERE nombre='Pescados de Río'), '🌿'),
('Boga a la Parrilla', 68000, (SELECT id FROM categorias WHERE nombre='Pescados de Río'), '🐡'),
('Camarones al Pil Pil', 82000, (SELECT id FROM categorias WHERE nombre='Mariscos'), '🦐'),
('Pulpo a la Gallega', 95000, (SELECT id FROM categorias WHERE nombre='Mariscos'), '🐙'),
('Cazuela de Mariscos', 98000, (SELECT id FROM categorias WHERE nombre='Mariscos'), '🍲'),
('Langostinos a la Manteca', 88000, (SELECT id FROM categorias WHERE nombre='Mariscos'), '🦞'),
('Risotto de Camarones', 65000, (SELECT id FROM categorias WHERE nombre='Arroces & Pastas'), '🍚'),
('Fideos Negros con Calamar', 62000, (SELECT id FROM categorias WHERE nombre='Arroces & Pastas'), '🦑'),
('Arroz con Mariscos', 70000, (SELECT id FROM categorias WHERE nombre='Arroces & Pastas'), '🥘'),
('Mousse de Maracuyá', 28000, (SELECT id FROM categorias WHERE nombre='Postres'), '🍮'),
('Tarta de Coco y Limón', 26000, (SELECT id FROM categorias WHERE nombre='Postres'), '🥥'),
('Limonada de Jengibre', 18000, (SELECT id FROM categorias WHERE nombre='Bebidas'), '🍋'),
('Tereré de Hierbas', 12000, (SELECT id FROM categorias WHERE nombre='Bebidas'), '🧉'),
('Vino Blanco Copa', 32000, (SELECT id FROM categorias WHERE nombre='Bebidas'), '🥂'),
('Agua de Coco Natural', 16000, (SELECT id FROM categorias WHERE nombre='Bebidas'), '🥤')
ON CONFLICT DO NOTHING;

-- Datos iniciales (Mesas)
INSERT INTO mesas (num, estado, personas) VALUES
(1, 'libre', 0),
(2, 'libre', 0),
(3, 'libre', 0),
(4, 'libre', 0),
(5, 'libre', 0),
(6, 'libre', 0),
(7, 'libre', 0),
(8, 'libre', 0)
ON CONFLICT (num) DO NOTHING;

-- Usuarios y Roles
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL,
    rol VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    home_page VARCHAR(50) NOT NULL
);

-- Datos iniciales (Usuarios)
INSERT INTO usuarios (username, password, rol, nombre, home_page) VALUES
('admin', '123', 'admin', 'Administrador', 'reportes.html'),
('cocina', '123', 'cocina', 'Jefe de Cocina', 'cocina.html'),
('mozo', '123', 'mozo', 'Mozo de Salón', 'pedidos.html')
ON CONFLICT (username) DO NOTHING;

