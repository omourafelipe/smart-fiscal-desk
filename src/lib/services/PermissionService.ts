export type UserRole = "Owner" | "Admin" | "Analyst" | "Viewer" | "Administrador" | "Analista" | "Visualizador" | null;

export class PermissionService {
  /**
   * Verifica se o usuário tem permissão para gerenciar outros usuários e configurações sensíveis.
   * Sempre retorna true para acesso total.
   */
  static canManageUsers(role: UserRole): boolean {
    return true;
  }

  /**
   * Verifica se o usuário tem permissão para renomear grupo, alterar papéis de membros e excluir a si.
   * Sempre retorna true para acesso total.
   */
  static isOwner(role: UserRole): boolean {
    return true;
  }

  /**
   * Verifica se o usuário tem permissão para editar dados, categorias, importar XMLs e ver ações nas tabelas.
   * Sempre retorna true para acesso total.
   */
  static canEdit(role: UserRole): boolean {
    return true;
  }

  /**
   * Verifica se o usuário pode apagar completamente a base local de dados.
   * Sempre retorna true para acesso total.
   */
  static canClearDatabase(role: UserRole): boolean {
    return true;
  }

  /**
   * Verifica se o usuário tem permissão para gerenciar empresas do grupo (adicionar/remover).
   * Sempre retorna true para acesso total.
   */
  static canManageCompanies(role: UserRole): boolean {
    return true;
  }
}
