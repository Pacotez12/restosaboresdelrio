require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la base de datos
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sabores_del_rio',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Asegurar columna 'activo' y restricción ON DELETE CASCADE en pedido_items
pool.query(`
  ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
  ALTER TABLE pedido_items 
  DROP CONSTRAINT IF EXISTS pedido_items_menu_item_id_fkey,
  ADD CONSTRAINT pedido_items_menu_item_id_fkey 
    FOREIGN KEY (menu_item_id) 
    REFERENCES menu_items(id) 
    ON DELETE CASCADE;
`).then(() => {
  console.log("Base de datos verificada (columna 'activo' y restricciones actualizadas).");
}).catch(err => {
  console.error("Error al actualizar la base de datos:", err);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// ============ API ENDPOINTS ============

// Login de usuario
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT username, rol, nombre, home_page FROM usuarios WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener Menú
app.get('/api/menu', async (req, res) => {
  const { todos } = req.query;
  try {
    let query = `
      SELECT m.id, m.nombre, m.precio, m.emoji, m.categoria_id, m.activo, c.nombre as cat 
      FROM menu_items m 
      JOIN categorias c ON m.categoria_id = c.id
    `;
    if (todos === 'true') {
      // Devolver todos para administración
    } else {
      query += ' WHERE m.activo = true';
    }
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener Mesas
app.get('/api/mesas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mesas ORDER BY num');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener Tickets (Pedidos)
app.get('/api/tickets', async (req, res) => {
  try {
    const pedidos = await pool.query('SELECT * FROM pedidos WHERE estado != \'cobrado\' ORDER BY fecha');
    const items = await pool.query(`
      SELECT pi.*, m.nombre, m.emoji 
      FROM pedido_items pi 
      JOIN menu_items m ON pi.menu_item_id = m.id
    `);
    
    const formatted = pedidos.rows.map(p => ({
      ...p,
      mesa: p.mesa_num,
      items: items.rows.filter(i => i.pedido_id === p.id).map(i => ({
        id: i.menu_item_id,
        nombre: i.nombre,
        emoji: i.emoji,
        precio: i.precio_unitario,
        qty: i.cantidad
      }))
    }));
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear Pedido
app.post('/api/tickets', async (req, res) => {
  const { mesa, items, notas } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Crear pedido
    const pedidoRes = await client.query(
      'INSERT INTO pedidos (mesa_num, notas, estado) VALUES ($1, $2, \'pendiente\') RETURNING id',
      [mesa, notas]
    );
    const pedidoId = pedidoRes.rows[0].id;
    
    // Insertar ítems
    for (const item of items) {
      await client.query(
        'INSERT INTO pedido_items (pedido_id, menu_item_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
        [pedidoId, item.id, item.qty, item.precio]
      );
    }
    
    // Actualizar estado de la mesa
    await client.query(
      'UPDATE mesas SET estado = \'ocupada\', personas = $1 WHERE num = $2',
      [Math.floor(Math.random() * 5) + 1, mesa]
    );
    
    await client.query('COMMIT');
    res.json({ id: pedidoId, message: 'Pedido creado con éxito' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Actualizar Estado de Pedido
app.put('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, id]);
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cobrar Pedido (Liberar mesa)
app.post('/api/cobrar', async (req, res) => {
  const { mesa } = req.body;
  try {
    await pool.query('UPDATE mesas SET estado = \'libre\', personas = 0 WHERE num = $1', [mesa]);
    await pool.query('UPDATE pedidos SET estado = \'cobrado\' WHERE mesa_num = $1 AND estado != \'cobrado\'', [mesa]);
    res.json({ message: 'Mesa liberada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener Reportes
app.get('/api/reportes', async (req, res) => {
  const { periodo } = req.query; // hoy, semana, mes
  let interval = '1 day';
  if (periodo === 'semana') interval = '7 days';
  if (periodo === 'mes') interval = '30 days';

  try {
    // KPIs
    const kpis = await pool.query(`
      SELECT 
        COALESCE(SUM(total), 0) as total_ventas,
        COUNT(id) as total_pedidos,
        COALESCE(AVG(total), 0) as ticket_promedio
      FROM (
        SELECT p.id, SUM(pi.cantidad * pi.precio_unitario) as total
        FROM pedidos p
        JOIN pedido_items pi ON p.id = pi.pedido_id
        WHERE p.fecha >= NOW() - INTERVAL '${interval}'
        AND p.estado = 'cobrado'
        GROUP BY p.id
      ) as subquery
    `);

    // Ventas por hora (últimas 24h para 'hoy', o promedio para el resto)
    const ventasHora = await pool.query(`
      SELECT EXTRACT(HOUR FROM fecha) as hora, COUNT(*) as pedidos
      FROM pedidos
      WHERE fecha >= NOW() - INTERVAL '${interval}'
      AND estado = 'cobrado'
      GROUP BY hora
      ORDER BY hora
    `);

    // Ventas por categoría
    const ventasCat = await pool.query(`
      SELECT c.nombre as n, COUNT(pi.id) as count
      FROM pedido_items pi
      JOIN menu_items m ON pi.menu_item_id = m.id
      JOIN categorias c ON m.categoria_id = c.id
      JOIN pedidos p ON pi.pedido_id = p.id
      WHERE p.fecha >= NOW() - INTERVAL '${interval}'
      AND p.estado = 'cobrado'
      GROUP BY c.nombre
    `);

    // Top Productos
    const topProductos = await pool.query(`
      SELECT m.nombre, c.nombre as cat, m.emoji, SUM(pi.cantidad) as vendidos, SUM(pi.cantidad * pi.precio_unitario) as ingresos
      FROM pedido_items pi
      JOIN menu_items m ON pi.menu_item_id = m.id
      JOIN categorias c ON m.categoria_id = c.id
      JOIN pedidos p ON pi.pedido_id = p.id
      WHERE p.fecha >= NOW() - INTERVAL '${interval}'
      AND p.estado = 'cobrado'
      GROUP BY m.nombre, c.nombre, m.emoji
      ORDER BY vendidos DESC
      LIMIT 10
    `);

    res.json({
      kpis: kpis.rows[0],
      ventasHora: ventasHora.rows,
      ventasCat: ventasCat.rows,
      topProductos: topProductos.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ USER CRUD ENDPOINTS ============

// Obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, password, rol, nombre, home_page FROM usuarios ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear usuario
app.post('/api/usuarios', async (req, res) => {
  const { username, password, rol, nombre } = req.body;
  let home_page = 'pedidos.html';
  if (rol === 'admin') home_page = 'reportes.html';
  else if (rol === 'cocina') home_page = 'cocina.html';

  try {
    const result = await pool.query(
      'INSERT INTO usuarios (username, password, rol, nombre, home_page) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, password, rol, nombre, home_page]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar usuario
app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, rol, nombre } = req.body;
  let home_page = 'pedidos.html';
  if (rol === 'admin') home_page = 'reportes.html';
  else if (rol === 'cocina') home_page = 'cocina.html';

  try {
    let result;
    if (password) {
      result = await pool.query(
        'UPDATE usuarios SET username = $1, password = $2, rol = $3, nombre = $4, home_page = $5 WHERE id = $6 RETURNING *',
        [username, password, rol, nombre, home_page, id]
      );
    } else {
      result = await pool.query(
        'UPDATE usuarios SET username = $1, rol = $2, nombre = $3, home_page = $4 WHERE id = $5 RETURNING *',
        [username, rol, nombre, home_page, id]
      );
    }
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar usuario
app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ success: true, message: 'Usuario eliminado con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ DISH (MENU ITEM) CRUD ENDPOINTS ============

// Obtener todas las categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear plato del menú
app.post('/api/menu', async (req, res) => {
  const { nombre, precio, categoria_id, emoji, activo } = req.body;
  const isActivo = activo !== undefined ? activo : true;
  try {
    const result = await pool.query(
      'INSERT INTO menu_items (nombre, precio, categoria_id, emoji, activo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, precio, categoria_id, emoji, isActivo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar plato del menú
app.put('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, categoria_id, emoji, activo } = req.body;
  const isActivo = activo !== undefined ? activo : true;
  try {
    const result = await pool.query(
      'UPDATE menu_items SET nombre = $1, precio = $2, categoria_id = $3, emoji = $4, activo = $5 WHERE id = $6 RETURNING *',
      [nombre, precio, categoria_id, emoji, isActivo, id]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Plato no encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar plato del menú (Soft Delete)
app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE menu_items SET activo = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Plato desactivado con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
