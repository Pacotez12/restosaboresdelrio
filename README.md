# Sabores del Río — gestión de restaurante

Sistema web para la operación diaria de un restaurante: mesas, pedidos, cocina, cobro, menú, usuarios por rol y reportes.

## Funcionalidades

- **Pedidos por mesa:** el mozo abre un ticket, agrega platos y lo envía a cocina.
- **Pantalla de cocina:** pedidos pendientes y cambio de estado a medida que se preparan.
- **Cobro:** cierre del ticket, registro del pago y liberación de la mesa.
- **Menú y categorías:** alta, edición y baja de platos.
- **Usuarios por rol:** login y vistas separadas según el rol (admin, mozo, cocina).
- **Reportes:** ventas cobradas.

## Stack

- **Backend:** Node.js + Express, API REST (`/api/menu`, `/api/tickets`, `/api/cobrar`, `/api/reportes`, `/api/usuarios`…)
- **Base de datos:** PostgreSQL 16 (esquema y datos iniciales en `init.sql`)
- **Frontend:** HTML, CSS y JavaScript sin frameworks
- **Infraestructura:** Docker Compose

## Puesta en marcha

```bash
docker compose up -d --build
```

La app queda en `http://localhost:4000` y PostgreSQL en el puerto `5433`.

Sin Docker: `npm install`, configurar las variables `DB_*` y correr `npm run dev`.
