const db = require('../config/db');

function parsePhotos(value) {
  try {
    const photos = JSON.parse(value || '[]');
    return Array.isArray(photos) ? photos.filter((name) => /^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(String(name)) || /^legacy:(presente-girassol\.jpeg|cesta-carolina\.jpg)$/i.test(String(name))) : [];
  } catch (_) { return []; }
}

function mapProduct(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents == null ? null : Number(row.price_cents),
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    available: Boolean(row.available),
    active: Boolean(row.active) && !row.deleted_at,
    photos: parsePhotos(row.photos_json),
    videoUrl: String(row.video_url || ''),
    legacy: Boolean(row.legacy_product),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at == null ? null : Number(row.deleted_at)
  };
}

const productSelect = `SELECT p.*, c.name AS category_name, c.slug AS category_slug
  FROM products p JOIN product_categories c ON c.id = p.category_id`;

function listCategories({ activeOnly = false } = {}) {
  return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count
    FROM product_categories c ${activeOnly ? 'WHERE c.active = 1' : ''} ORDER BY c.name COLLATE NOCASE`).all();
}

function getCategoryById(id) {
  return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count
    FROM product_categories c WHERE c.id = ?`).get(id) || null;
}

function createCategory({ name, slug, actorId }) {
  const result = db.prepare('INSERT INTO product_categories (name, slug, created_by) VALUES (?, ?, ?)').run(name, slug, actorId);
  return getCategoryById(result.lastInsertRowid);
}

function updateCategory(id, { name, slug }) {
  const result = db.prepare('UPDATE product_categories SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
  return Number(result.changes) > 0 ? getCategoryById(id) : null;
}

function setCategoryActive(id, active) {
  return Number(db.prepare('UPDATE product_categories SET active = ? WHERE id = ?').run(active ? 1 : 0, id).changes) > 0;
}

function listProducts({ publicOnly = false, includeDeleted = false } = {}) {
  const clauses = [];
  if (publicOnly) clauses.push('p.active = 1', 'p.available = 1', 'p.deleted_at IS NULL', 'c.active = 1');
  else if (!includeDeleted) clauses.push('p.deleted_at IS NULL');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`${productSelect} ${where} ORDER BY p.updated_at DESC, p.id DESC`).all().map(mapProduct);
}

function getProductById(id, { includeDeleted = false } = {}) {
  const deletedClause = includeDeleted ? '' : 'AND p.deleted_at IS NULL';
  return mapProduct(db.prepare(`${productSelect} WHERE p.id = ? ${deletedClause}`).get(id));
}

function getPublishedProductBySlug(slug) {
  return mapProduct(db.prepare(`${productSelect}
    WHERE p.slug = ? AND p.active = 1 AND p.available = 1 AND p.deleted_at IS NULL AND c.active = 1`).get(slug));
}

function getPublishedProductByName(name) {
  return mapProduct(db.prepare(`${productSelect}
    WHERE p.name = ? COLLATE NOCASE AND p.active = 1 AND p.available = 1 AND p.deleted_at IS NULL AND c.active = 1`).get(name));
}

function productPhotoIsPublished(filename) {
  return Boolean(db.prepare(`SELECT 1 FROM products p JOIN product_categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.available = 1 AND p.deleted_at IS NULL AND c.active = 1
      AND EXISTS (SELECT 1 FROM json_each(p.photos_json) WHERE json_each.value = ?) LIMIT 1`).get(filename));
}

function productPhotoIsStored(filename) {
  return Boolean(db.prepare(`SELECT 1 FROM products p
    WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM json_each(p.photos_json) WHERE json_each.value = ?) LIMIT 1`).get(filename));
}

function productPhotoExists(filename) {
  return Boolean(db.prepare(`SELECT 1 FROM products p
    WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM json_each(p.photos_json) WHERE json_each.value = ?) LIMIT 1`).get(filename));
}

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

function uniqueProductSlug(name, exceptId = null) {
  const base = slugify(name) || 'produto';
  let slug = base;
  let suffix = 2;
  while (db.prepare('SELECT id FROM products WHERE slug = ? AND (? IS NULL OR id <> ?)').get(slug, exceptId, exceptId)) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

function createProduct(snapshot, actorId, { legacy = false } = {}) {
  const insert = db.prepare(`INSERT INTO products
    (slug, name, description, price_cents, category_id, available, active, photos_json, video_url, legacy_product, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const result = insert.run(snapshot.slug, snapshot.name, snapshot.description, snapshot.priceCents,
    snapshot.categoryId, snapshot.available ? 1 : 0, snapshot.active ? 1 : 0,
    JSON.stringify(snapshot.photos), snapshot.videoUrl || '', legacy ? 1 : 0, actorId, actorId);
  return getProductById(result.lastInsertRowid);
}

function updateProduct(id, snapshot, actorId) {
  db.prepare(`UPDATE products SET slug = ?, name = ?, description = ?, price_cents = ?, category_id = ?,
     available = ?, active = ?, photos_json = ?, video_url = ?, updated_by = ?, updated_at = unixepoch(),
    deleted_at = CASE WHEN ? THEN NULL ELSE deleted_at END
    WHERE id = ? AND deleted_at IS NULL`).run(snapshot.slug, snapshot.name, snapshot.description,
    snapshot.priceCents, snapshot.categoryId, snapshot.available ? 1 : 0, snapshot.active ? 1 : 0,
    JSON.stringify(snapshot.photos), snapshot.videoUrl || '', actorId, snapshot.active ? 1 : 0, id);
  return getProductById(id);
}

function applyChange(action, productId, snapshot, actorId) {
  if (action === 'create') return createProduct(snapshot, actorId);
  if (action === 'delete') {
    db.prepare(`UPDATE products SET active = 0, deleted_at = unixepoch(), updated_by = ?, updated_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`).run(actorId, productId);
    return getProductById(productId, { includeDeleted: true });
  }
  if (action === 'deactivate') {
    const next = { ...snapshot, active: false };
    return updateProduct(productId, next, actorId);
  }
  return updateProduct(productId, snapshot, actorId);
}

function insertChangeRequest({ productId = null, action, before, after, actorId }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (productId != null && hasPendingRequest(productId)) {
      const error = new Error('Já existe uma solicitação pendente para este produto.');
      error.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw error;
    }
    const result = db.prepare(`INSERT INTO product_change_requests
      (product_id, action, before_json, after_json, requested_by)
      VALUES (?, ?, ?, ?, ?)`).run(productId, action, before ? JSON.stringify(before) : null, JSON.stringify(after), actorId);
    db.exec('COMMIT');
    return Number(result.lastInsertRowid);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function hasPendingRequest(productId) {
  return Boolean(db.prepare(`SELECT 1 FROM product_change_requests WHERE product_id = ? AND status = 'pending' LIMIT 1`).get(productId));
}

function listPendingRequests() {
  return db.prepare(`SELECT r.*, p.name AS current_product_name, a.name AS requester_name, a.role AS requester_role
    FROM product_change_requests r
    LEFT JOIN products p ON p.id = r.product_id
    JOIN admins a ON a.id = r.requested_by
    WHERE r.status = 'pending'
    ORDER BY r.requested_at ASC, r.id ASC`).all().map((row) => ({
      ...row,
      id: Number(row.id),
      productId: row.product_id == null ? null : Number(row.product_id),
      before: row.before_json ? JSON.parse(row.before_json) : null,
      after: JSON.parse(row.after_json),
      requestedAt: Number(row.requested_at),
      action: row.action,
      requesterName: row.requester_name,
      requesterRole: row.requester_role
    }));
}

function approveRequest(requestId, reviewerId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare(`SELECT * FROM product_change_requests WHERE id = ? AND status = 'pending'`).get(requestId);
    if (!row) {
      db.exec('ROLLBACK');
      return null;
    }
    const after = JSON.parse(row.after_json);
    const product = applyChange(row.action, row.product_id, after, row.requested_by);
    db.prepare(`UPDATE product_change_requests SET status = 'approved', reviewed_by = ?, reviewed_at = unixepoch(), product_id = ? WHERE id = ?`)
      .run(reviewerId, product ? product.id : row.product_id, requestId);
    db.exec('COMMIT');
    return { requestId: Number(requestId), action: row.action, before: row.before_json ? JSON.parse(row.before_json) : null, after, product };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function rejectRequest(requestId, reviewerId, note = '') {
  const result = db.prepare(`UPDATE product_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = unixepoch(), review_note = ?
    WHERE id = ? AND status = 'pending'`).run(reviewerId, note, requestId);
  return Number(result.changes) > 0;
}

function applyImmediate(action, productId, snapshot, actorId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (productId != null) {
      db.prepare(`UPDATE product_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = unixepoch(),
        review_note = 'Substituída por uma alteração aplicada imediatamente.' WHERE product_id = ? AND status = 'pending'`)
        .run(actorId, productId);
    }
    const product = applyChange(action, productId, snapshot, actorId);
    db.exec('COMMIT');
    return product;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  mapProduct,
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  setCategoryActive,
  listProducts,
  getProductById,
  getPublishedProductBySlug,
  getPublishedProductByName,
  productPhotoIsPublished,
  productPhotoIsStored,
  productPhotoExists,
  uniqueProductSlug,
  createProduct,
  updateProduct,
  insertChangeRequest,
  hasPendingRequest,
  listPendingRequests,
  approveRequest,
  rejectRequest,
  applyImmediate
};
