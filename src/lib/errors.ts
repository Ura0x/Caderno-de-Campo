/** Erro já traduzido, pronto para mostrar ao usuário. */
export class AppError extends Error {}

interface DbError {
  message: string
  code?: string
  details?: string | null
}

/** Mensagens para restrições de unicidade, pelo nome da constraint no banco. */
const DUPLICATES: Record<string, string> = {
  crops_user_id_name_key: 'Já existe uma cultura com esse nome.',
  varieties_crop_id_name_key: 'Essa cultura já tem uma variedade com esse nome.',
  sheet_clients_pkey: 'Esse cliente já está vinculado à planilha.',
}

const GENERIC = 'Algo deu errado. Tente de novo; se continuar, recarregue a página.'
const OFFLINE = 'Sem conexão com a internet. Verifique a rede e tente de novo.'

/** Traduz um erro do Supabase/Postgres para uma mensagem em português. */
export function translateDbError(error: DbError): AppError {
  const { code, message } = error
  if (/fetch|network|load failed/i.test(message)) return new AppError(OFFLINE)

  switch (code) {
    case '23505': {
      const constraint = message.match(/constraint "([^"]+)"/)?.[1]
      return new AppError((constraint && DUPLICATES[constraint]) || 'Esse registro já existe.')
    }
    case '23503':
      return new AppError('Esse item está sendo usado em outro lugar e não pode ser alterado ou excluído.')
    case '23502':
      return new AppError('Preencha todos os campos obrigatórios.')
    case '22001':
      return new AppError('O texto digitado é longo demais.')
    case '42501':
      return new AppError('Você não tem permissão para fazer isso. Saia e entre de novo na sua conta.')
    case 'PGRST116':
      return new AppError('Registro não encontrado. Ele pode ter sido excluído.')
    case 'PGRST301':
    case 'PGRST303':
      return new AppError('Sua sessão expirou. Saia e entre de novo na sua conta.')
  }
  console.error(error)
  return new AppError(GENERIC)
}

/** Mensagem amigável para qualquer erro (os já traduzidos passam direto). */
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof Error && /fetch|network|load failed/i.test(error.message)) return OFFLINE
  console.error(error)
  return GENERIC
}
