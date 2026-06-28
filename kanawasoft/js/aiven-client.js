// js/aiven-client.js
// KanawaSoft ERP - Cliente PostgreSQL (Aiven)
// Versão 3.0.0
// ============================================================
// ATENÇÃO: Este arquivo usa as Netlify Functions como proxy
// para o PostgreSQL (Aiven) - NUNCA exponha credenciais no frontend
// ============================================================

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const API_BASE = '/.netlify/functions';
const ADMIN_TOKEN = localStorage.getItem('admin_token') || '';

// ============================================================
// HEADERS
// ============================================================
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
    };
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: getHeaders()
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE}/${endpoint}`, options);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ erro: response.statusText }));
        throw new Error(error.erro || error.message || `Erro ${response.status}`);
    }

    const result = await response.json();
    return result;
}

// ============================================================
// CLIENTE AIVEN
// ============================================================
const AivenAPI = {
    // ============================================================
    // USUÁRIOS
    // ============================================================
    async getUsers() {
        const result = await apiRequest(`carregar?tabela=usuarios&limite=500`);
        return result.dados || [];
    },

    async getUser(id) {
        const result = await apiRequest(`carregar?tabela=usuarios&id=${id}`);
        return result.dados?.[0] || null;
    },

    async getUserByEmail(email) {
        const result = await apiRequest(`carregar?tabela=usuarios&email=${email}`);
        return result.dados?.[0] || null;
    },

    async createUser(user) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'usuarios',
            dados: user
        });
        return result.dados;
    },

    async updateUser(id, user) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'usuarios',
            id: id,
            dados: user
        });
        return result.dados;
    },

    async deleteUser(id) {
        const result = await apiRequest(`deletar?tabela=usuarios&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // PRODUTOS
    // ============================================================
    async getProducts() {
        const result = await apiRequest(`carregar?tabela=produtos&limite=1000`);
        return result.dados || [];
    },

    async getProduct(id) {
        const result = await apiRequest(`carregar?tabela=produtos&id=${id}`);
        return result.dados?.[0] || null;
    },

    async getProductByCode(code) {
        const result = await apiRequest(`carregar?tabela=produtos&codigo=${code}`);
        return result.dados?.[0] || null;
    },

    async getProductsByCategory(categoryId) {
        const result = await apiRequest(`carregar?tabela=produtos&categoria_id=${categoryId}`);
        return result.dados || [];
    },

    async createProduct(product) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'produtos',
            dados: product
        });
        return result.dados;
    },

    async updateProduct(id, product) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'produtos',
            id: id,
            dados: product
        });
        return result.dados;
    },

    async deleteProduct(id) {
        const result = await apiRequest(`deletar?tabela=produtos&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // CLIENTES
    // ============================================================
    async getClients() {
        const result = await apiRequest(`carregar?tabela=clientes&limite=1000`);
        return result.dados || [];
    },

    async getClient(id) {
        const result = await apiRequest(`carregar?tabela=clientes&id=${id}`);
        return result.dados?.[0] || null;
    },

    async getClientByNif(nif) {
        const result = await apiRequest(`carregar?tabela=clientes&nif=${nif}`);
        return result.dados?.[0] || null;
    },

    async createClient(client) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'clientes',
            dados: client
        });
        return result.dados;
    },

    async updateClient(id, client) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'clientes',
            id: id,
            dados: client
        });
        return result.dados;
    },

    async deleteClient(id) {
        const result = await apiRequest(`deletar?tabela=clientes&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    async getTopClients(limit = 10) {
        const result = await apiRequest(`carregar?tabela=clientes&orderBy=total_compras DESC&limite=${limit}`);
        return result.dados || [];
    },

    // ============================================================
    // VENDAS
    // ============================================================
    async getSales() {
        const result = await apiRequest(`carregar?tabela=vendas&limite=500`);
        return result.dados || [];
    },

    async getSale(id) {
        const result = await apiRequest(`carregar?tabela=vendas&id=${id}`);
        return result.dados?.[0] || null;
    },

    async getSaleByInvoice(invoice) {
        const result = await apiRequest(`carregar?tabela=vendas&invoice=${invoice}`);
        return result.dados?.[0] || null;
    },

    async getSalesByClient(clientId) {
        const result = await apiRequest(`carregar?tabela=vendas&cliente_id=${clientId}`);
        return result.dados || [];
    },

    async getSalesByPeriod(startDate, endDate) {
        const result = await apiRequest(
            `carregar?tabela=vendas&data_inicio=${startDate}&data_fim=${endDate}`
        );
        return result.dados || [];
    },

    async createSale(sale) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'vendas',
            dados: sale
        });
        return result.dados;
    },

    async updateSale(id, sale) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'vendas',
            id: id,
            dados: sale
        });
        return result.dados;
    },

    async deleteSale(id) {
        const result = await apiRequest(`deletar?tabela=vendas&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    async getSalesTotal(period = 'month') {
        const result = await apiRequest(`carregar?tabela=vendas&periodo=${period}`);
        return result.dados || [];
    },

    // ============================================================
    // ORÇAMENTOS
    // ============================================================
    async getBudgets() {
        const result = await apiRequest(`carregar?tabela=orcamentos&limite=500`);
        return result.dados || [];
    },

    async getBudget(id) {
        const result = await apiRequest(`carregar?tabela=orcamentos&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createBudget(budget) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'orcamentos',
            dados: budget
        });
        return result.dados;
    },

    async updateBudget(id, budget) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'orcamentos',
            id: id,
            dados: budget
        });
        return result.dados;
    },

    async deleteBudget(id) {
        const result = await apiRequest(`deletar?tabela=orcamentos&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // CONTAS FINANCEIRAS
    // ============================================================
    async getContas() {
        const result = await apiRequest(`carregar?tabela=contas&limite=1000`);
        return result.dados || [];
    },

    async getConta(id) {
        const result = await apiRequest(`carregar?tabela=contas&id=${id}`);
        return result.dados?.[0] || null;
    },

    async getContasByTipo(tipo) {
        const result = await apiRequest(`carregar?tabela=contas&tipo=${tipo}`);
        return result.dados || [];
    },

    async getContasByStatus(status) {
        const result = await apiRequest(`carregar?tabela=contas&status=${status}`);
        return result.dados || [];
    },

    async getContasVencidas() {
        const result = await apiRequest(`carregar?tabela=contas&status=Pendente&vencidas=true`);
        return result.dados || [];
    },

    async createConta(conta) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'contas',
            dados: conta
        });
        return result.dados;
    },

    async updateConta(id, conta) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'contas',
            id: id,
            dados: conta
        });
        return result.dados;
    },

    async deleteConta(id) {
        const result = await apiRequest(`deletar?tabela=contas&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    async baixarConta(id, dataPagamento = null) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'contas',
            id: id,
            dados: {
                status: 'Pago',
                data_pagamento: dataPagamento || new Date().toISOString().slice(0, 10)
            }
        });
        return result.dados;
    },

    // ============================================================
    // MOVIMENTAÇÕES DE ESTOQUE
    // ============================================================
    async getMovimentacoes() {
        const result = await apiRequest(`carregar?tabela=movimentacoes&limite=1000`);
        return result.dados || [];
    },

    async getMovimentacoesByProduto(produtoId) {
        const result = await apiRequest(`carregar?tabela=movimentacoes&produto_id=${produtoId}`);
        return result.dados || [];
    },

    async getMovimentacoesByPeriod(startDate, endDate) {
        const result = await apiRequest(
            `carregar?tabela=movimentacoes&data_inicio=${startDate}&data_fim=${endDate}`
        );
        return result.dados || [];
    },

    async createMovimentacao(movimentacao) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'movimentacoes',
            dados: movimentacao
        });
        return result.dados;
    },

    // ============================================================
    // CATEGORIAS
    // ============================================================
    async getCategorias() {
        const result = await apiRequest(`carregar?tabela=categorias&limite=500`);
        return result.dados || [];
    },

    async getCategoria(id) {
        const result = await apiRequest(`carregar?tabela=categorias&id=${id}`);
        return result.dados?.[0] || null;
    },

    async getCategoriasByPai(paiId) {
        const result = await apiRequest(`carregar?tabela=categorias&pai_id=${paiId}`);
        return result.dados || [];
    },

    async createCategoria(categoria) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'categorias',
            dados: categoria
        });
        return result.dados;
    },

    async updateCategoria(id, categoria) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'categorias',
            id: id,
            dados: categoria
        });
        return result.dados;
    },

    async deleteCategoria(id) {
        const result = await apiRequest(`deletar?tabela=categorias&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // FORNECEDORES
    // ============================================================
    async getFornecedores() {
        const result = await apiRequest(`carregar?tabela=fornecedores&limite=500`);
        return result.dados || [];
    },

    async getFornecedor(id) {
        const result = await apiRequest(`carregar?tabela=fornecedores&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createFornecedor(fornecedor) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'fornecedores',
            dados: fornecedor
        });
        return result.dados;
    },

    async updateFornecedor(id, fornecedor) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'fornecedores',
            id: id,
            dados: fornecedor
        });
        return result.dados;
    },

    async deleteFornecedor(id) {
        const result = await apiRequest(`deletar?tabela=fornecedores&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // FUNCIONÁRIOS
    // ============================================================
    async getFuncionarios() {
        const result = await apiRequest(`carregar?tabela=funcionarios&limite=500`);
        return result.dados || [];
    },

    async getFuncionario(id) {
        const result = await apiRequest(`carregar?tabela=funcionarios&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createFuncionario(funcionario) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'funcionarios',
            dados: funcionario
        });
        return result.dados;
    },

    async updateFuncionario(id, funcionario) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'funcionarios',
            id: id,
            dados: funcionario
        });
        return result.dados;
    },

    async deleteFuncionario(id) {
        const result = await apiRequest(`deletar?tabela=funcionarios&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // PROJETOS
    // ============================================================
    async getProjetos() {
        const result = await apiRequest(`carregar?tabela=projetos&limite=500`);
        return result.dados || [];
    },

    async getProjeto(id) {
        const result = await apiRequest(`carregar?tabela=projetos&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createProjeto(projeto) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'projetos',
            dados: projeto
        });
        return result.dados;
    },

    async updateProjeto(id, projeto) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'projetos',
            id: id,
            dados: projeto
        });
        return result.dados;
    },

    async deleteProjeto(id) {
        const result = await apiRequest(`deletar?tabela=projetos&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // ATENDIMENTOS (CRM)
    // ============================================================
    async getAtendimentos() {
        const result = await apiRequest(`carregar?tabela=atendimentos&limite=500`);
        return result.dados || [];
    },

    async getAtendimento(id) {
        const result = await apiRequest(`carregar?tabela=atendimentos&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createAtendimento(atendimento) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'atendimentos',
            dados: atendimento
        });
        return result.dados;
    },

    async updateAtendimento(id, atendimento) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'atendimentos',
            id: id,
            dados: atendimento
        });
        return result.dados;
    },

    async deleteAtendimento(id) {
        const result = await apiRequest(`deletar?tabela=atendimentos&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // TRANSPORTADORAS
    // ============================================================
    async getTransportadoras() {
        const result = await apiRequest(`carregar?tabela=transportadoras&limite=500`);
        return result.dados || [];
    },

    async getTransportadora(id) {
        const result = await apiRequest(`carregar?tabela=transportadoras&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createTransportadora(transportadora) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'transportadoras',
            dados: transportadora
        });
        return result.dados;
    },

    async updateTransportadora(id, transportadora) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'transportadoras',
            id: id,
            dados: transportadora
        });
        return result.dados;
    },

    async deleteTransportadora(id) {
        const result = await apiRequest(`deletar?tabela=transportadoras&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // ENTREGAS
    // ============================================================
    async getEntregas() {
        const result = await apiRequest(`carregar?tabela=entregas&limite=500`);
        return result.dados || [];
    },

    async getEntrega(id) {
        const result = await apiRequest(`carregar?tabela=entregas&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createEntrega(entrega) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'entregas',
            dados: entrega
        });
        return result.dados;
    },

    async updateEntrega(id, entrega) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'entregas',
            id: id,
            dados: entrega
        });
        return result.dados;
    },

    async deleteEntrega(id) {
        const result = await apiRequest(`deletar?tabela=entregas&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // MARKETING (CAMPANHAS)
    // ============================================================
    async getCampanhas() {
        const result = await apiRequest(`carregar?tabela=marketing&limite=500`);
        return result.dados || [];
    },

    async getCampanha(id) {
        const result = await apiRequest(`carregar?tabela=marketing&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createCampanha(campanha) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'marketing',
            dados: campanha
        });
        return result.dados;
    },

    async updateCampanha(id, campanha) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'marketing',
            id: id,
            dados: campanha
        });
        return result.dados;
    },

    async deleteCampanha(id) {
        const result = await apiRequest(`deletar?tabela=marketing&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // FILIAIS
    // ============================================================
    async getFiliais() {
        const result = await apiRequest(`carregar?tabela=filiais&limite=500`);
        return result.dados || [];
    },

    async getFilial(id) {
        const result = await apiRequest(`carregar?tabela=filiais&id=${id}`);
        return result.dados?.[0] || null;
    },

    async createFilial(filial) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'filiais',
            dados: filial
        });
        return result.dados;
    },

    async updateFilial(id, filial) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'filiais',
            id: id,
            dados: filial
        });
        return result.dados;
    },

    async deleteFilial(id) {
        const result = await apiRequest(`deletar?tabela=filiais&id=${id}&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // EMPRESA
    // ============================================================
    async getCompany() {
        const result = await apiRequest(`carregar?tabela=empresa&limite=1`);
        return result.dados?.[0] || null;
    },

    async updateCompany(company) {
        const existing = await this.getCompany();
        if (existing) {
            const result = await apiRequest('salvar', 'POST', {
                tabela: 'empresa',
                id: existing.id,
                dados: company
            });
            return result.dados;
        } else {
            const result = await apiRequest('salvar', 'POST', {
                tabela: 'empresa',
                dados: company
            });
            return result.dados;
        }
    },

    // ============================================================
    // LOGS
    // ============================================================
    async getLogs(limit = 100) {
        const result = await apiRequest(`carregar?tabela=logs&limite=${limit}`);
        return result.dados || [];
    },

    async createLog(log) {
        const result = await apiRequest('salvar', 'POST', {
            tabela: 'logs',
            dados: log
        });
        return result.dados;
    },

    async clearLogs() {
        const result = await apiRequest(`deletar?tabela=logs&confirmar=CONFIRMAR`, 'DELETE');
        return result.sucesso;
    },

    // ============================================================
    // BACKUP
    // ============================================================
    async createBackup() {
        const result = await apiRequest('backup', 'POST', { acao: 'criar' });
        return result.backup;
    },

    async restoreBackup(backup, confirm = false) {
        const result = await apiRequest('backup', 'POST', {
            acao: 'restaurar',
            dados: { backup, confirmar: confirm ? 'CONFIRMAR_RESTAURACAO' : '' }
        });
        return result;
    },

    async getBackupList() {
        const result = await apiRequest('backup', 'POST', { acao: 'listar' });
        return result.backups || [];
    },

    async downloadBackup() {
        const result = await apiRequest('backup', 'POST', { acao: 'download' });
        return result;
    },

    async getBackupInfo() {
        const result = await apiRequest('backup', 'POST', { acao: 'info' });
        return result;
    },

    // ============================================================
    // RELATÓRIOS
    // ============================================================
    async getRelatorio(tipo, periodo = '30 days', dataInicio = null, dataFim = null) {
        const result = await apiRequest('relatorio', 'POST', {
            tipo,
            periodo,
            data_inicio: dataInicio,
            data_fim: dataFim
        });
        return result.dados;
    },

    async getRelatorioVendas(periodo = '30 days') {
        return await this.getRelatorio('vendas', periodo);
    },

    async getRelatorioProdutos() {
        return await this.getRelatorio('produtos');
    },

    async getRelatorioFinanceiro() {
        return await this.getRelatorio('financeiro');
    },

    async getRelatorioClientes() {
        return await this.getRelatorio('clientes');
    },

    async getRelatorioEstoque() {
        return await this.getRelatorio('estoque');
    },

    async getRelatorioRH() {
        return await this.getRelatorio('rh');
    },

    async getRelatorioCompleto(periodo = '30 days') {
        return await this.getRelatorio('completo', periodo);
    },

    // ============================================================
    // SINCRONIZAÇÃO
    // ============================================================
    async syncData(data, chave = 'dados_principais', versao = 0) {
        const result = await apiRequest('sincronizar', 'POST', {
            acao: 'enviar',
            dados: data,
            chave,
            versao
        });
        return result;
    },

    async getSyncedData(chave = 'dados_principais') {
        const result = await apiRequest('sincronizar', 'POST', {
            acao: 'receber',
            chave
        });
        return result.dados;
    },

    async getSyncKeys() {
        const result = await apiRequest('sincronizar', 'POST', { acao: 'listar' });
        return result.chaves || [];
    },

    async deleteSyncKey(chave) {
        const result = await apiRequest('sincronizar', 'POST', {
            acao: 'deletar',
            dados: { chave }
        });
        return result.sucesso;
    },

    async getSyncStatus() {
        const result = await apiRequest('sincronizar', 'POST', { acao: 'status' });
        return result.status;
    },

    // ============================================================
    // NOTIFICAÇÕES
    // ============================================================
    async sendNotification(titulo, mensagem, destino = 'todos', tipo = 'info', link = '') {
        const result = await apiRequest('notificacao', 'POST', {
            acao: 'enviar',
            dados: { titulo, mensagem, destino, tipo, link }
        });
        return result;
    },

    async getNotifications(limit = 50) {
        const result = await apiRequest('notificacao', 'POST', {
            acao: 'listar',
            dados: { limite: limit }
        });
        return result.notificacoes || [];
    },

    async checkNotifications() {
        const result = await apiRequest('notificacao', 'POST', { acao: 'verificar' });
        return result;
    },

    async markNotificationRead(id) {
        const result = await apiRequest('notificacao', 'POST', {
            acao: 'marcar_lida',
            dados: { id }
        });
        return result.sucesso;
    },

    async clearOldNotifications() {
        const result = await apiRequest('notificacao', 'POST', { acao: 'limpar' });
        return result.sucesso;
    },

    // ============================================================
    // EMAIL
    // ============================================================
    async sendEmail(to, assunto, template, dados = {}) {
        const result = await apiRequest('email', 'POST', {
            to,
            assunto,
            template,
            dados,
            token: ADMIN_TOKEN
        });
        return result.sucesso;
    },

    async sendWelcomeEmail(to, nome) {
        return await this.sendEmail(to, 'Bem-vindo ao KanawaSoft ERP', 'bem_vindo', { nome });
    },

    async sendPasswordReset(to, nome, novaSenha) {
        return await this.sendEmail(to, 'Recuperação de Senha', 'recuperacao_senha', { nome, nova_senha: novaSenha });
    },

    async sendReport(to, nome, dados, tipo = 'Relatório') {
        return await this.sendEmail(to, `Relatório ${tipo}`, 'relatorio', { nome, dados, tipo });
    },

    // ============================================================
    // EXPORTAÇÃO/IMPORTAÇÃO
    // ============================================================
    async exportData(tabelas, formato = 'json', filtros = null) {
        const result = await apiRequest('exportar', 'POST', {
            tabelas,
            formato,
            filtros
        });
        return result;
    },

    async importData(tabela, dados, sobrescrever = false) {
        const result = await apiRequest('importar', 'POST', {
            tabela,
            dados,
            sobrescrever
        });
        return result;
    },

    // ============================================================
    // ADMIN
    // ============================================================
    async getAdminStats() {
        const result = await apiRequest('admin', 'POST', { acao: 'stats' });
        return result.stats;
    },

    async getSystemInfo() {
        const result = await apiRequest('admin', 'POST', { acao: 'system_info' });
        return result.sistema;
    },

    async resetDatabase(confirm = false) {
        const result = await apiRequest('admin', 'POST', {
            acao: 'reset',
            dados: { confirmar: confirm ? 'RESETAR_TUDO' : '' }
        });
        return result;
    },

    async getUsersList() {
        const result = await apiRequest('admin', 'POST', { acao: 'users' });
        return result.usuarios || [];
    },

    async createAdminUser(nome, email, senha, perfil = 'admin') {
        const result = await apiRequest('admin', 'POST', {
            acao: 'user_create',
            dados: { nome, email, senha, perfil }
        });
        return result.usuario;
    },

    async updateAdminUser(id, dados) {
        const result = await apiRequest('admin', 'POST', {
            acao: 'user_update',
            dados: { id, ...dados }
        });
        return result.usuario;
    },

    async deleteAdminUser(id) {
        const result = await apiRequest('admin', 'POST', {
            acao: 'user_delete',
            dados: { id }
        });
        return result.sucesso;
    }
};

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.AivenAPI = AivenAPI;
    console.log('✅ AivenAPI (PostgreSQL) carregado com sucesso!');
}

// ============================================================
// MÓDULO (para Node.js)
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AivenAPI;
}