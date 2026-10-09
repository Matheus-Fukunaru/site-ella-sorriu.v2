const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  listCategories, getCategoryById, createCategory, updateCategory, setCategoryActive,
  listProducts, getProductById, getPublishedProductBySlug, productPhotoIsPublished, productPhotoIsStored,
  uniqueProductSlug, createProduct, insertChangeRequest, hasPendingRequest,
  listPendingRequests, approveRequest, rejectRequest, applyImmediate
} = require('../models/productsModel');
const { recordAudit } = require('../models/auditLogModel');

const MEDIA_DIRECTORY = path.join(__dirname, '..', 'data', 'product-media');
const MAX_PHOTOS = 6;
const MAX_PRICE_CENTS = 999_999_999;

function actorCanPublishImmediately(admin) {
  return admin.role === 'owner' || admin.role === 'admin' ||
    (admin.role === 'attendant' && Number(admin.product_approval_exempt) === 1);
}

function normalizePhotos(value) {
  let photos = value;
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch (_) { return null; }
  }
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS) return null;
  const clean = photos.map((item) => String(item || '').trim());
  if (clean.some((item) => !/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(item) && !/^legacy:(presente-girassol\.jpeg|cesta-carolina\.jpg)$/i.test(item))) return null;
  return [...new Set(clean)];
}

function normalizeSnapshot(body, actorId, exceptId = null) {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const categoryId = Number(body.category_id);
  const priceText = String(body.price || '').trim().replace(',', '.');
  const price = Number(priceText);
  const priceCents = Number.isFinite(price) ? Math.round(price * 100) : 0;
  const photos = normalizePhotos(body.photos_json || '[]');
  const videoUrl = String(body.video_url || '').trim();
  const category = Number.isInteger(categoryId) && categoryId > 0 ? getCategoryById(categoryId) : null;
  if (name.length < 2 || name.length > 120) return { error: 'Informe um nome com 2 a 120 caracteres.' };
  if (description.length > 1800) return { error: 'A descrição pode ter até 1.800 caracteres.' };
  if (!category || !category.active) return { error: 'Selecione uma categoria ativa.' };
  if (priceCents < 1 || priceCents > MAX_PRICE_CENTS) return { error: 'Informe um preço válido.' };
  if (!photos) return { error: 'Revise as fotos selecionadas. São aceitas até seis imagens JPG, PNG ou WebP.' };
  if (videoUrl && !/^https:\/\/[^\s]+$/i.test(videoUrl)) return { error: 'O vídeo precisa ser um endereço HTTPS válido.' };
  return {
    snapshot: {
      slug: uniqueProductSlug(name, exceptId),
      name,
      description,
      priceCents,
      categoryId,
      categoryName: category.name,
      categorySlug: category.slug,
      available: body.available === '1' || body.available === true,
      active: body.active === '1' || body.active === true,
      photos,
      videoUrl,
      actorId
    }
  };
}

function auditProduct({ actor, action, productId, before, after, approval = 'immediate', reviewer = null }) {
  recordAudit({
    actorAdminId: actor.id,
    action,
    targetType: 'product',
    targetId: productId,
    details: JSON.stringify({
      actorRole: actor.role,
      approval,
      before: before || null,
      after: after || null,
      reviewerId: reviewer
    })
  });
}

function renderProducts(req, res, options = {}) {
  const pendingProductIds = new Set(listPendingRequests().map((request) => Number(request.productId)).filter(Boolean));
  return res.status(options.status || 200).render('products', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    categories: listCategories(),
    products: listProducts({ includeDeleted: true }).map((product) => ({ ...product, pending: pendingProductIds.has(product.id) })),
    error: options.error || null,
    success: options.success || null,
    canManageCategories: ['owner', 'admin'].includes(req.admin.role),
    pendingCount: ['owner', 'admin'].includes(req.admin.role) ? listPendingRequests().length : 0,
    canReviewProducts: ['owner', 'admin'].includes(req.admin.role)
  });
}

function productsPage(req, res) {
  const success = req.query.pending === '1' ? 'Alteração enviada para aprovação.'
    : ['created', 'updated'].includes(req.query.published) ? 'Produto publicado com sucesso.'
      : req.query.category ? 'Categoria atualizada.' : null;
  return renderProducts(req, res, { success });
}

function productForm(req, res) {
  const id = req.params.id ? Number(req.params.id) : null;
  const product = id == null ? null : getProductById(id);
  if (id != null && (!Number.isInteger(id) || !product)) return res.status(404).render('forbidden', { admin: req.admin });
  if (product && hasPendingRequest(product.id)) {
    return renderProducts(req, res, { status: 409, error: 'Este produto já tem uma alteração aguardando aprovação.' });
  }
  return res.render('product-form', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    categories: listCategories({ activeOnly: true }),
    product,
    error: null,
    approvalExempt: actorCanPublishImmediately(req.admin)
  });
}

function saveProduct(req, res, next) {
  try {
    const id = req.params.id ? Number(req.params.id) : null;
    const before = id == null ? null : getProductById(id);
    if (id != null && (!Number.isInteger(id) || !before)) return res.status(404).render('forbidden', { admin: req.admin });
    if (before && hasPendingRequest(id)) return renderProducts(req, res, { status: 409, error: 'Este produto já tem uma alteração aguardando aprovação.' });
    const result = normalizeSnapshot(req.body, req.admin.id, id);
    if (result.error) {
      return res.status(400).render('product-form', {
        admin: req.admin,
        csrfToken: req.cookies.csrf_token,
        categories: listCategories({ activeOnly: true }),
        product: before ? { ...before, ...(result.snapshot || {}) } : result.snapshot || null,
        error: result.error,
        approvalExempt: actorCanPublishImmediately(req.admin)
      });
    }
    const after = result.snapshot;
    const action = before ? 'update' : 'create';
    if (actorCanPublishImmediately(req.admin)) {
      const product = applyImmediate(action, id, after, req.admin.id);
      auditProduct({ actor: req.admin, action: before ? 'product_updated' : 'product_created', productId: product.id, before, after, approval: req.admin.role === 'attendant' ? 'exempt' : 'not_required' });
      return res.redirect(`/admin/products?published=${before ? 'updated' : 'created'}`);
    }
    const requestId = insertChangeRequest({ productId: id, action, before, after, actorId: req.admin.id });
    auditProduct({ actor: req.admin, action: 'product_change_requested', productId: id || `request-${requestId}`, before, after, approval: 'pending' });
    return res.redirect('/admin/products?pending=1');
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return renderProducts(req, res, { status: 409, error: 'Já existe uma solicitação pendente para este produto.' });
    }
    next(error);
  }
}

function changeProductState(req, res, next) {
  try {
    const id = Number(req.params.id);
    const before = getProductById(id);
    if (!Number.isInteger(id) || !before) return res.status(404).render('forbidden', { admin: req.admin });
    if (hasPendingRequest(id)) return renderProducts(req, res, { status: 409, error: 'Este produto já tem uma solicitação pendente.' });
    const action = req.body.action === 'delete' ? 'delete' : 'deactivate';
    const after = { ...before, active: false, actorId: req.admin.id };
    if (actorCanPublishImmediately(req.admin)) {
      const product = applyImmediate(action, id, after, req.admin.id);
      auditProduct({ actor: req.admin, action: action === 'delete' ? 'product_archived' : 'product_deactivated', productId: id, before, after, approval: req.admin.role === 'attendant' ? 'exempt' : 'not_required' });
      return res.redirect('/admin/products');
    }
    const requestId = insertChangeRequest({ productId: id, action, before, after, actorId: req.admin.id });
    auditProduct({ actor: req.admin, action: 'product_change_requested', productId: id, before, after, approval: 'pending' });
    return res.redirect('/admin/products?pending=1');
  } catch (error) { next(error); }
}

function createCategoryHandler(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 80) return renderProducts(req, res, { status: 400, error: 'O nome da categoria precisa ter de 2 a 80 caracteres.' });
    const slugBase = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'categoria';
    const category = createCategory({ name, slug: slugBase, actorId: req.admin.id });
    recordAudit({ actorAdminId: req.admin.id, action: 'product_category_created', targetType: 'product_category', targetId: category.id, details: JSON.stringify({ name }) });
    return res.redirect('/admin/products?category=created');
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return renderProducts(req, res, { status: 409, error: 'Já existe uma categoria com esse nome ou endereço.' });
    next(error);
  }
}

function updateCategoryHandler(req, res, next) {
  try {
    const id = Number(req.params.id);
    const before = getCategoryById(id);
    const name = String(req.body.name || '').trim();
    if (!before || !Number.isInteger(id) || name.length < 2 || name.length > 80) return renderProducts(req, res, { status: 400, error: 'Categoria ou nome inválido.' });
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `categoria-${id}`;
    const category = updateCategory(id, { name, slug });
    recordAudit({ actorAdminId: req.admin.id, action: 'product_category_updated', targetType: 'product_category', targetId: id, details: JSON.stringify({ before: before.name, after: category.name }) });
    return res.redirect('/admin/products?category=updated');
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return renderProducts(req, res, { status: 409, error: 'Já existe outra categoria com esse nome.' });
    next(error);
  }
}

function toggleCategoryHandler(req, res, next) {
  try {
    const id = Number(req.params.id);
    const category = getCategoryById(id);
    if (!Number.isInteger(id) || !category) return res.status(404).render('forbidden', { admin: req.admin });
    const active = req.body.active === '1';
    setCategoryActive(id, active);
    recordAudit({ actorAdminId: req.admin.id, action: active ? 'product_category_activated' : 'product_category_deactivated', targetType: 'product_category', targetId: id, details: JSON.stringify({ name: category.name, active }) });
    return res.redirect('/admin/products');
  } catch (error) { next(error); }
}

function approvalsPage(req, res) {
  const requests = listPendingRequests();
  const success = req.query.approved === '1' ? 'Alteração aprovada e publicada.'
    : req.query.rejected === '1' ? 'Solicitação rejeitada.'
      : req.query.changed === '1' ? 'A solicitação já havia sido revisada.' : null;
  return res.render('approvals', { admin: req.admin, csrfToken: req.cookies.csrf_token, requests, error: null, success });
}

function approveProductChange(req, res, next) {
  try {
    const id = Number(req.params.id);
    const approved = approveRequest(id, req.admin.id);
    if (!approved) return res.redirect('/admin/approvals?changed=1');
    auditProduct({ actor: req.admin, action: 'product_change_approved', productId: approved.product.id, before: approved.before, after: approved.after, approval: 'approved', reviewer: req.admin.id });
    return res.redirect('/admin/approvals?approved=1');
  } catch (error) { next(error); }
}

function rejectProductChange(req, res, next) {
  try {
    const id = Number(req.params.id);
    const request = listPendingRequests().find((item) => item.id === id);
    if (!request || !rejectRequest(id, req.admin.id, String(req.body.note || '').trim().slice(0, 500))) return res.redirect('/admin/approvals?changed=1');
    auditProduct({ actor: req.admin, action: 'product_change_rejected', productId: request.productId || `request-${id}`, before: request.before, after: request.after, approval: 'rejected', reviewer: req.admin.id });
    return res.redirect('/admin/approvals?rejected=1');
  } catch (error) { next(error); }
}

function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', ext: 'png' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

function uploadProductImage(req, res) {
  const buffer = req.rawImageBuffer;
  const type = sniffImage(buffer);
  if (!type) return res.status(415).json({ success: false, message: 'Envie uma imagem JPG, PNG ou WebP válida.' });
  if (buffer.length > 3 * 1024 * 1024) return res.status(413).json({ success: false, message: 'Cada foto pode ter no máximo 3 MB.' });
  fs.mkdirSync(MEDIA_DIRECTORY, { recursive: true, mode: 0o700 });
  const filename = `${crypto.randomUUID()}.${type.ext}`;
  const filePath = path.join(MEDIA_DIRECTORY, filename);
  fs.writeFileSync(filePath, buffer, { flag: 'wx', mode: 0o600 });
  res.status(201).json({ success: true, filename, previewUrl: `/admin/products/media/${filename}` });
}

function safeMediaPath(filename) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(String(filename || ''))) return null;
  return path.join(MEDIA_DIRECTORY, filename);
}

function adminProductMedia(req, res) {
  if (/^legacy:/i.test(req.params.filename)) {
    const filename = req.params.filename.slice('legacy:'.length);
    if (!['presente-girassol.jpeg', 'cesta-carolina.jpg'].includes(filename) || !productPhotoIsStored(req.params.filename)) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return res.sendFile(path.join(__dirname, '..', '..', 'front-end', 'imagens', 'produtos', filename));
  }
  const filePath = safeMediaPath(req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) return res.sendStatus(404);
  res.set({ 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
  return res.sendFile(filePath);
}

function publicProductMedia(req, res) {
  if (/^legacy:/i.test(req.params.filename)) {
    const filename = req.params.filename.slice('legacy:'.length);
    if (!['presente-girassol.jpeg', 'cesta-carolina.jpg'].includes(filename) || !productPhotoIsPublished(req.params.filename)) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    return res.sendFile(path.join(__dirname, '..', '..', 'front-end', 'imagens', 'produtos', filename));
  }
  const filePath = safeMediaPath(req.params.filename);
  if (!filePath || !productPhotoIsPublished(req.params.filename) || !fs.existsSync(filePath)) return res.sendStatus(404);
  res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
  return res.sendFile(filePath);
}

function publicCatalog(req, res) {
  const products = listProducts({ publicOnly: true }).map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    available: product.available,
    videoUrl: product.videoUrl,
    photos: product.photos.map((filename) => `/media/products/${encodeURIComponent(filename)}`)
  }));
  const productCategoryIds = new Set(products.map((product) => product.categoryId));
  const categories = listCategories({ activeOnly: true }).filter((category) => productCategoryIds.has(Number(category.id)))
    .map((category) => ({ id: Number(category.id), name: category.name, slug: category.slug }));
  res.set('Cache-Control', 'no-store').json({ categories, products });
}

function publicProduct(req, res) {
  const product = getPublishedProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
  res.set('Cache-Control', 'no-store').json({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    categoryName: product.categoryName,
    available: product.available,
    videoUrl: product.videoUrl,
    photos: product.photos.map((filename) => `/media/products/${encodeURIComponent(filename)}`)
  });
}

module.exports = {
  actorCanPublishImmediately,
  renderProducts,
  productsPage,
  productForm,
  saveProduct,
  changeProductState,
  createCategoryHandler,
  updateCategoryHandler,
  toggleCategoryHandler,
  approvalsPage,
  approveProductChange,
  rejectProductChange,
  uploadProductImage,
  adminProductMedia,
  publicProductMedia,
  publicCatalog,
  publicProduct,
  MEDIA_DIRECTORY
};
