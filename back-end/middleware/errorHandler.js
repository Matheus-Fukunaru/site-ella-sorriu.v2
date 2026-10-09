function notFound(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Rota não encontrada.' });
  }
  res.status(404).send('Página não encontrada.');
}

// Handler global de erros. Nunca envia stack trace, mensagem interna do
// banco, nem detalhes de implementação para o cliente — tudo isso vai só
// para o log do servidor. O usuário recebe sempre uma mensagem genérica e
// amigável.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;

  console.error(`[erro] ${req.method} ${req.originalUrl} ->`, err.message);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack);
  }

  if (req.path.startsWith('/api')) {
    return res.status(status).json({
      success: false,
      message: 'Ocorreu um erro ao processar sua solicitação. Tente novamente em instantes.'
    });
  }

  res.status(status).send('Ocorreu um erro. Tente novamente mais tarde.');
}

module.exports = { notFound, errorHandler };