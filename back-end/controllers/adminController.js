const {
  listOrders,
  getOrderById,
  updateStatus: updateStatusModel,
  deleteOrder: deleteOrderModel,
  listClients
} = require('../models/ordersModel');
const { STATUS_OPTIONS, ATTENDANT_STATUS_OPTIONS } = require('../config/constants');
const { recordAudit } = require('../models/auditLogModel');

const STATUS_CLASSES = Object.freeze({
  'Novo': 'status--novo',
  'Em contato': 'status--em-contato',
  'Confirmado': 'status--confirmado',
  'Em produção': 'status--em-producao',
  'Entregue': 'status--entregue',
  'Cancelado': 'status--cancelado'
});

function statusClass(status) {
  return STATUS_CLASSES[status] || '';
}

function buildWhatsappUrl(order) {
  const phoneDigits = String(order.whatsapp || '').replace(/\D/g, '');
  const phoneNumber = phoneDigits.length === 10 || phoneDigits.length === 11
    ? `55${phoneDigits}`
    : phoneDigits;
  if (!/^55\d{10,11}$/.test(phoneNumber)) return null;

  const message = `Olá, ${order.nome}! Aqui é da Ella Sorriu. Estou entrando em contato sobre o seu pedido.`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

function dashboard(req, res) {
  const statusFilter = STATUS_OPTIONS.includes(req.query.status) ? req.query.status : null;
  const orders = listOrders({ status: statusFilter }).map((order) => ({
    ...order,
    whatsappUrl: buildWhatsappUrl(order)
  }));

  res.render('dashboard', {
    orders,
    statusFilter,
    statusOptions: STATUS_OPTIONS,
    admin: req.admin,
    activeSection: 'orders',
    csrfToken: req.cookies.csrf_token,
    statusClass
  });
}

function orderDetail(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).send('Pedido não encontrado.');
  }

  const order = getOrderById(id);
  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  res.render('order', {
    order,
    admin: req.admin,
    statusOptions: req.admin.role === 'attendant' ? ATTENDANT_STATUS_OPTIONS : STATUS_OPTIONS,
    csrfToken: req.cookies.csrf_token,
    whatsappUrl: buildWhatsappUrl(order),
    statusClass
  });
}

function updateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  const allowedStatuses = req.admin.role === 'attendant' ? ATTENDANT_STATUS_OPTIONS : STATUS_OPTIONS;
  if (!Number.isInteger(id) || id <= 0 || !allowedStatuses.includes(status)) {
    return res.status(400).send('Dados inválidos.');
  }

  const order = getOrderById(id);
  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  updateStatusModel(id, status);
  recordAudit({
    actorAdminId: req.admin.id,
    action: 'order_status_changed',
    targetType: 'order',
    targetId: id,
    details: `${order.status}->${status}`
  });
  res.redirect(`/admin/orders/${id}`);
}

function deleteOrder(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).send('Dados inválidos.');
  }

  const order = getOrderById(id);
  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  deleteOrderModel(id);
  recordAudit({ actorAdminId: req.admin.id, action: 'order_deleted', targetType: 'order', targetId: id });
  res.redirect('/admin');
}

function clientsPage(req, res) {
  const clients = listClients().map((client) => ({
    ...client,
    whatsappUrl: buildWhatsappUrl(client)
  }));
  res.render('clients', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    clients
  });
}

module.exports = { dashboard, orderDetail, updateStatus, deleteOrder, clientsPage };
