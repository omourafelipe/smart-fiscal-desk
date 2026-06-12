export type UserRole = "Owner" | "Administrador" | "Analista" | "Visualizador" | null;

export class PermissionService {
  /**
   * Verifica se o usuário tem permissão para gerenciar outros usuários e configurações sensíveis.
   * Apenas Owner e Administrador.
   */
  static canManageUsers(role: UserRole): boolean {
    return role === "Owner" || role === "Administrador";
  }

  /**
   * Verifica se o usuário tem permissão para renomear grupo, alterar papéis de membros e excluir a si.
   * Apenas Owner.
   */
  static isOwner(role: UserRole): boolean {
    return role === "Owner";
  }

  /**
   * Verifica se o usuário tem permissão para editar dados, categorias, importar XMLs e ver ações nas tabelas.
   * Qualquer um acima de Visualizador.
   */
  static canEdit(role: UserRole): boolean {
    return role === "Owner" || role === "Administrador" || role === "Analista";
  }

  /**
   * Verifica se o usuário pode apagar completamente a base local de dados.
   * Restrito a quem tem poder de edição.
   */
  static canClearDatabase(role: UserRole): boolean {
    return this.canEdit(role);
  }

  /**
   * Verifica se o usuário tem permissão para gerenciar empresas do grupo (adicionar/remover).
   */
  static canManageCompanies(role: UserRole): boolean {
    return this.canManageUsers(role);
  }
}
