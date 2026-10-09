const db = require('../config/db');

const insertStmt = db.prepare(`
  INSERT INTO orders (
    nome, whatsapp, email, cesta, destinatario, ocasiao, mensagem,
    preferencias, observacoes, cidade, bairro, data_desejada, periodo_desejado
  ) VALUES (
    @nome, @whatsapp, @email, @cesta, @destinatario, @ocasiao, @mensagem,
    @preferencias, @observacoes, @cidade, @bairro, @data_desejada, @periodo_desejado
  )
`);

function createOrder(data) {
  const info = insertStmt.run(data);
  return info.lastInsertRowid;
}

function listOrders({ status } = {}) {
  if (status) {
    return db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC, id DESC').all(status);
  }
  return db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC').all();
}

function getOrderById(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

function updateStatus(id, status) {
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

function deleteOrder(id) {
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

function listClients() {
  return db.prepare(`
    WITH ranked AS (
      SELECT nome, whatsapp, email, cidade, created_at,
             COUNT(*) OVER (PARTITION BY whatsapp) AS order_count,
             ROW_NUMBER() OVER (PARTITION BY whatsapp ORDER BY created_at DESC, id DESC) AS position
      FROM orders
    )
    SELECT nome, whatsapp, email, cidade, created_at AS last_order_at, order_count
    FROM ranked
    WHERE position = 1
    ORDER BY last_order_at DESC
  `).all();
}

module.exports = { createOrder, listOrders, getOrderById, updateStatus, deleteOrder, listClients };
