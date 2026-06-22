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
  try {
    const result = await pool.query(`
      SELECT m.id, m.nombre, m.precio, m.emoji, c.nombre as cat 
      FROM menu_items m 
      JOIN categorias c ON m.categoria_id = c.id
    `);
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

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
