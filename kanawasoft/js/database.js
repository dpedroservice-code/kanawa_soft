// ============================================================
// KANAWASOFT ERP - DATABASE.JS
// ============================================================
// Versão 3.0.0 - PostgreSQL (Aiven) + LocalStorage
// ============================================================

const DB_CONFIG = {
    name: 'kanawasoft_db',
    version: 3,
    stores: [
        'usuarios', 'empresa', 'clientes', 'produtos', 'vendas',
        'orcamentos', 'contas', 'movimentacoes', 'transferencias',
        'categorias', 'notas_fiscais', 'devolucoes', 'logs',
        'fornecedores', 'pedidos_compra', 'funcionarios', 'pontos',
        'projetos', 'atendimentos', 'transportadoras', 'entregas',
        'marketing', 'filiais', 'backups', 'configuracoes'
    ]
};

// ============================================================
// DATABASE CLASS
// ============================================================
class Database {
    constructor() {
        this.isOnline = navigator.onLine;
        this._initialized = false;
        this.listeners = [];
        this.cache = {};

        // Inicializar dados vazios
        for (const store of DB_CONFIG.stores) {
            this[store] = [];
        }

        // Carregar do localStorage
        this.loadFromLocalStorage();
    }

    // ============================================================
    // LOCAL STORAGE
    // ============================================================
    loadFromLocalStorage() {
        for (const store of DB_CONFIG.stores) {
            const key = `kanawasoft_${store}`;
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    this[store] = JSON.parse(data);
                } catch {
                    this[store] = [];
                }
            }
        }

        // Carregar empresa separadamente
        const empresaData = localStorage.getItem('kanawasoft_empresa');
        if (empresaData) {
            try {
                this.empresa = JSON.parse(empresaData);
            } catch {
                this.empresa = null;
            }
        }
    }

    saveToLocalStorage(store) {
        const key = `kanawasoft_${store}`;
        localStorage.setItem(key, JSON.stringify(this[store] || []));
    }

    saveEmpresa() {
        localStorage.setItem('kanawasoft_empresa', JSON.stringify(this.empresa));
    }

    // ============================================================
    // CRUD OPERAÇÕES
    // ============================================================
    insert(store, data) {
        if (!this[store]) this[store] = [];
        
        // Gerar ID
        const maxId = this[store].reduce((max, item) => Math.max(max, item.id || 0), 0);
        data.id = maxId + 1;
        
        // Timestamps
        data.criado_em = data.criado_em || new Date().toISOString();
        data.atualizado_em = new Date().toISOString();

        this[store].push(data);
        this.saveToLocalStorage(store);
        this.notify('insert', { store, data });

        // Tentar salvar no servidor
        this.syncToServer('insert', store, data);

        return data;
    }

    update(store, id, data) {
        const index = this[store]?.findIndex(item => item.id === id);
        if (index === -1 || index === undefined) {
            throw new Error('Registro não encontrado');
        }

        data.atualizado_em = new Date().toISOString();
        this[store][index] = { ...this[store][index], ...data };
        this.saveToLocalStorage(store);
        this.notify('update', { store, id, data });

        // Tentar salvar no servidor
        this.syncToServer('update', store, { id, ...data });

        return this[store][index];
    }

    delete(store, id) {
        const index = this[store]?.findIndex(item => item.id === id);
        if (index === -1 || index === undefined) {
            throw new Error('Registro não encontrado');
        }

        this[store].splice(index, 1);
        this.saveToLocalStorage(store);
        this.notify('delete', { store, id });

        // Tentar deletar no servidor
        this.syncToServer('delete', store, { id });

        return true;
    }

    get(store, id) {
        return this[store]?.find(item => item.id === id) || null;
    }

    getAll(store) {
        return this[store] || [];
    }

    clear(store) {
        this[store] = [];
        this.saveToLocalStorage(store);
        this.notify('clear', { store });
    }

    // ============================================================
    // SINCRONIZAÇÃO COM SERVIDOR
    // ============================================================
    async syncToServer(action, store, data) {
        if (!this.isOnline) {
            // Adicionar à fila para sincronizar depois
            if (!window._syncQueue) window._syncQueue = [];
            window._syncQueue.push({ action, store, data });
            return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) return;

            let endpoint, body;

            switch (action) {
                case 'insert':
                case 'update':
                    endpoint = '/.netlify/functions/salvar';
                    body = {
                        tabela: store,
                        dados: data,
                        id: action === 'update' ? data.id : undefined
                    };
                    break;
                case 'delete':
                    endpoint = `/.netlify/functions/deletar?tabela=${store}&id=${data.id}&confirmar=CONFIRMAR`;
                    body = null;
                    break;
                default:
                    return;
            }

            const response = await fetch(endpoint, {
                method: action === 'delete' ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                console.warn(`⚠️ Erro ao sincronizar ${action} em ${store}:`, response.status);
            }

        } catch (error) {
            console.warn('⚠️ Erro ao sincronizar:', error.message);
            // Adicionar à fila
            if (!window._syncQueue) window._syncQueue = [];
            window._syncQueue.push({ action, store, data });
        }
    }

    async processSyncQueue() {
        if (!window._syncQueue || window._syncQueue.length === 0) return;
        if (!this.isOnline) return;

        const queue = [...window._syncQueue];
        window._syncQueue = [];

        for (const item of queue) {
            await this.syncToServer(item.action, item.store, item.data);
        }
    }

    // ============================================================
    // EVENTOS
    // ============================================================
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (error) {
                console.error('❌ Erro no listener:', error);
            }
        }
    }

    // ============================================================
    // UTILITÁRIOS
    // ============================================================
    getStats() {
        const stats = {};
        for (const store of DB_CONFIG.stores) {
            stats[store] = this[store]?.length || 0;
        }
        return stats;
    }

    getCacheSize() {
        let total = 0;
        for (const store of DB_CONFIG.stores) {
            total += this[store]?.length || 0;
        }
        return total;
    }

    clearCache() {
        for (const store of DB_CONFIG.stores) {
            this[store] = [];
            this.saveToLocalStorage(store);
        }
        this.empresa = null;
        this.saveEmpresa();
        this.notify('clear_cache', {});
    }

    // ============================================================
    // VALIDAÇÕES
    // ============================================================
    validate(store, data) {
        switch (store) {
            case 'usuarios':
                if (!data.nome) return 'Nome é obrigatório';
                if (!data.email) return 'Email é obrigatório';
                if (!data.senha_hash) return 'Senha é obrigatória';
                break;
            case 'produtos':
                if (!data.nome) return 'Nome é obrigatório';
                if (!data.codigo) return 'Código é obrigatório';
                if (data.preco < 0) return 'Preço não pode ser negativo';
                if (data.estoque < 0) return 'Estoque não pode ser negativo';
                break;
            case 'clientes':
                if (!data.nome) return 'Nome é obrigatório';
                break;
            case 'vendas':
                if (!data.invoice) return 'Invoice é obrigatório';
                if (!data.items || data.items.length === 0) return 'Venda sem itens';
                if (data.total < 0) return 'Total não pode ser negativo';
                break;
            case 'contas':
                if (!data.descricao) return 'Descrição é obrigatória';
                if (data.valor < 0) return 'Valor não pode ser negativo';
                if (!data.data_vencimento) return 'Data de vencimento é obrigatória';
                break;
        }
        return null;
    }
}

// ============================================================
// INSTÂNCIA GLOBAL
// ============================================================
const db = new Database();

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.db = db;
}

console.log('✅ database.js carregado!');