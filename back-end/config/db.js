// Camada de acesso ao banco de dados.
//
// Por que SQLite (better-sqlite3) e não Postgres/Supabase direto?
// Para um pequeno negócio com um único administrador e volume baixo de
// pedidos, SQLite é robusto o suficiente para produção, não exige um
// serviço de banco separado (menos peças para manter/pagar) e funciona
// muito bem em qualquer VPS ou serviço de hospedagem com disco
// persistente (Railway, Render "Web Service", um VPS comum etc.).
//
// Importante: SQLite não funciona bem em hospedagens *serverless* onde o
// sistema de arquivos é temporário (ex.: Vercel/Netlify Functions), porque
// o arquivo do banco seria apagado a cada novo deploy/instância. Se for
// hospedar assim, troque este arquivo por uma conexão Postgres (ex.: via
// Supabase, usando a biblioteca "pg") mantendo a mesma DATABASE_URL — o
// resto da aplicação (models, controllers, rotas) não depende de SQLite
// diretamente, então a troca fica isolada aqui.

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { PROJECT_ROOT } = require('./env');

const rawUrl = process.env.DATABASE_URL || 'file:./back-end/data/ella-sorriu.db';
const dbPath = rawUrl.startsWith('file:') ? rawUrl.slice('file:'.length) : rawUrl;
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(PROJECT_ROOT, dbPath);

if (process.env.NODE_ENV !== 'production' && process.env.ELLA_QUIET_START !== '1') {
  console.log(`[db] usando banco: ${resolvedPath}`);
}

const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

const db = new DatabaseSync(resolvedPath);
if (process.platform !== 'win32') {
  try {
    fs.chmodSync(resolvedPath, 0o600);
  } catch (err) {
    console.warn('[banco] não foi possível restringir as permissões do arquivo:', err.message);
  }
}
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA trusted_schema = OFF');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT,
    cesta TEXT NOT NULL,
    destinatario TEXT,
    ocasiao TEXT NOT NULL,
    mensagem TEXT,
    preferencias TEXT,
    observacoes TEXT,
    cidade TEXT NOT NULL,
    bairro TEXT,
    data_desejada TEXT,
    periodo_desejado TEXT,
    status TEXT NOT NULL DEFAULT 'Novo',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'support', 'admin', 'attendant')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    support_access_until INTEGER,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
  CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
`);

// Migration idempotente para bancos criados por versões anteriores.
const adminColumns = new Set(
  db.prepare('PRAGMA table_info(admins)').all().map((column) => column.name)
);
const missingAdminColumns = [
  ['name', 'name TEXT'],
  ['role', "role TEXT NOT NULL DEFAULT 'owner'"],
  ['active', 'active INTEGER NOT NULL DEFAULT 1'],
  ['support_access_until', 'support_access_until INTEGER'],
  ['last_login_at', 'last_login_at TEXT'],
  ['updated_at', 'updated_at TEXT'],
  ['product_approval_exempt', 'product_approval_exempt INTEGER NOT NULL DEFAULT 0'],
  ['product_approval_granted_by', 'product_approval_granted_by INTEGER'],
  ['product_approval_granted_at', 'product_approval_granted_at INTEGER']
];

for (const [column, definition] of missingAdminColumns) {
  if (!adminColumns.has(column)) {
    db.exec(`ALTER TABLE admins ADD COLUMN ${definition}`);
  }
}

db.exec(`
  UPDATE admins
  SET name = COALESCE(NULLIF(TRIM(name), ''), 'Proprietário'),
      role = CASE
        WHEN role IN ('owner', 'support', 'admin', 'attendant') THEN role
        ELSE 'owner'
      END,
      active = CASE WHEN active = 0 THEN 0 ELSE 1 END,
      updated_at = COALESCE(updated_at, created_at, datetime('now'));

  CREATE TABLE IF NOT EXISTS admin_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('support', 'admin', 'attendant')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (invited_by) REFERENCES admins(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_admin_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (actor_admin_id) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_admins_role_active ON admins(role, active);
  CREATE INDEX IF NOT EXISTS idx_admin_invites_token ON admin_invites(token_hash, expires_at);
  CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash, expires_at);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at DESC);

  CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_by INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER,
    category_id INTEGER NOT NULL,
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    photos_json TEXT NOT NULL DEFAULT '[]',
    video_url TEXT NOT NULL DEFAULT '',
    legacy_product INTEGER NOT NULL DEFAULT 0 CHECK (legacy_product IN (0, 1)),
    created_by INTEGER,
    updated_by INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at INTEGER,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS product_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'deactivate', 'delete')),
    before_json TEXT,
    after_json TEXT NOT NULL,
    requested_by INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER,
    reviewed_at INTEGER,
    review_note TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES admins(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_public ON products(active, available, deleted_at, category_id);
  CREATE INDEX IF NOT EXISTS idx_product_requests_pending ON product_change_requests(status, requested_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_requests_product ON product_change_requests(product_id, requested_at DESC);

  CREATE TABLE IF NOT EXISTS gift_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    recipient_name TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    occasion TEXT NOT NULL,
    style TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'light',
    reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
    smooth_reading INTEGER NOT NULL DEFAULT 1 CHECK (smooth_reading IN (0, 1)),
    photo_url TEXT,
    letter_one TEXT NOT NULL,
    letter_two TEXT,
    letter_three TEXT,
    qr_style TEXT NOT NULL DEFAULT 'heart',
    coupon_code TEXT,
    coupon_percent INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'not_started',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    published_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_gift_sites_slug ON gift_sites(slug);
  CREATE INDEX IF NOT EXISTS idx_gift_sites_created_at ON gift_sites(created_at DESC);
`);

const productColumns = new Set(db.prepare('PRAGMA table_info(products)').all().map((column) => column.name));
if (!productColumns.has('video_url')) db.exec("ALTER TABLE products ADD COLUMN video_url TEXT NOT NULL DEFAULT ''");

const giftColumns = new Set(db.prepare('PRAGMA table_info(gift_sites)').all().map((column) => column.name));
for (const [column, definition] of [
  ['photos_json', "photos_json TEXT NOT NULL DEFAULT '[]'"],
  ['carousels_json', "carousels_json TEXT NOT NULL DEFAULT '[]'"],
  ['music_url', 'music_url TEXT'],
  ['font_style', "font_style TEXT NOT NULL DEFAULT 'editorial'"],
  ['extra_note', "extra_note TEXT NOT NULL DEFAULT ''"],
  ['photo_layout', "photo_layout TEXT NOT NULL DEFAULT 'gallery'"],
  ['music_title', "music_title TEXT NOT NULL DEFAULT ''"],
  ['show_title', 'show_title INTEGER NOT NULL DEFAULT 1'],
  ['page_title', "page_title TEXT NOT NULL DEFAULT ''"],
  ['person_style', "person_style TEXT NOT NULL DEFAULT 'neutral'"],
  ['letters_json', "letters_json TEXT NOT NULL DEFAULT '[]'"]
]) {
  if (!giftColumns.has(column)) db.exec(`ALTER TABLE gift_sites ADD COLUMN ${definition}`);
}

if (Number(db.prepare('PRAGMA user_version').get().user_version) < 5) db.exec('PRAGMA user_version = 5');

// Seed aditivo para preservar as quatro composições que já eram exibidas
// diretamente no HTML antes de o catálogo ser administrável.
const legacyCategorySeeds = [
  ['Café da manhã', 'cafe-da-manha'],
  ['Românticos', 'romanticos'],
  ['Celebrações', 'celebracoes'],
  ['Personalizados', 'personalizados']
];
for (const [name, slug] of legacyCategorySeeds) {
  db.prepare('INSERT OR IGNORE INTO product_categories (name, slug, active) VALUES (?, ?, 1)').run(name, slug);
}

if (Number(db.prepare('SELECT COUNT(*) AS total FROM products').get().total) === 0) {
  const legacyProducts = [
    { slug: 'doce-amanhecer', name: 'Doce Amanhecer', description: 'Uma composição real da Ella Sorriu para começar o dia com afeto. Os detalhes são ajustados durante o atendimento.', category: 'Café da manhã', photo: 'legacy:presente-girassol.jpeg' },
    { slug: 'com-todo-amor', name: 'Com Todo Amor', description: 'Uma proposta romântica da seleção Ella Sorriu. A composição e as personalizações são combinadas durante o atendimento.', category: 'Românticos', photo: null },
    { slug: 'momento-especial', name: 'Momento Especial', description: 'Uma composição real da Ella Sorriu para celebrar momentos especiais. Os detalhes são ajustados durante o atendimento.', category: 'Celebrações', photo: 'legacy:cesta-carolina.jpg' },
    { slug: 'personalizada', name: 'Monte do seu jeito', description: 'Um ponto de partida para criar uma composição personalizada com a identidade de quem vai receber.', category: 'Personalizados', photo: 'legacy:presente-girassol.jpeg' }
  ];
  const insertLegacy = db.prepare(`INSERT OR IGNORE INTO products (slug, name, description, category_id, photos_json, legacy_product)
    VALUES (?, ?, ?, (SELECT id FROM product_categories WHERE name = ?), ?, 1)`);
  for (const item of legacyProducts) {
    insertLegacy.run(item.slug, item.name, item.description, item.category, JSON.stringify(item.photo ? [item.photo] : []));
  }
}

db.exec('PRAGMA optimize');

module.exports = db;
