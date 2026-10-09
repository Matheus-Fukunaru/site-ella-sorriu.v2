// Listas fechadas (whitelist) usadas tanto na validação do backend quanto
// para popular os <select> renderizados no painel admin. Front e back
// precisam concordar com essas mesmas opções — se adicionar uma cesta ou
// ocasião nova, atualize aqui E no formulário em frontend/pedido.html.

const VALID_CESTAS = [
  'Doce Amanhecer',
  'Com Todo Amor',
  'Momento Especial',
  'Quero montar uma cesta personalizada'
];

const VALID_OCASIOES = [
  'Aniversário',
  'Namoro',
  'Casamento',
  'Dia dos Namorados',
  'Agradecimento',
  'Pedido de desculpas',
  'Outra'
];

const VALID_PERIODOS = ['Manhã', 'Tarde', 'Noite'];

const STATUS_OPTIONS = [
  'Novo',
  'Em contato',
  'Confirmado',
  'Em produção',
  'Entregue',
  'Cancelado'
];

const ADMIN_ROLES = ['owner', 'support', 'admin', 'attendant'];
const ROLE_LABELS = {
  owner: 'Proprietário',
  support: 'Suporte técnico',
  admin: 'Administrador',
  attendant: 'Atendente'
};
const ATTENDANT_STATUS_OPTIONS = ['Novo', 'Em contato', 'Confirmado'];

module.exports = {
  VALID_CESTAS,
  VALID_OCASIOES,
  VALID_PERIODOS,
  STATUS_OPTIONS,
  ADMIN_ROLES,
  ROLE_LABELS,
  ATTENDANT_STATUS_OPTIONS
};
