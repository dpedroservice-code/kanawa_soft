// ============================================================
// KANAWASOFT ERP - AUTH.JS
// ============================================================
// Versão 3.0.0 - Autenticação Local
// ============================================================

const AUTH = {
    // ============================================================
    // LOGIN
    // ============================================================
    async login(email, password) {
        try {
            // Buscar usuário no banco local
            const users = db.getAll('usuarios');
            const user = users.find(u => u.email === email);

            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            // Verificar senha
            const hash = btoa(password + 'kanawa_salt');
            if (user.senha_hash !== hash) {
                throw new Error('Senha incorreta');
            }

            if (user.status !== 'Ativo') {
                throw new Error('Usuário inativo');
            }

            // Salvar sessão
            const token = 'token_' + Date.now() + '_' + Math.random().toString(36);
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));

            // Atualizar último login
            user.ultimo_login = new Date().toISOString();
            db.update('usuarios', user.id, user);

            return user;

        } catch (error) {
            console.error('❌ Erro no login:', error);
            throw error;
        }
    },

    // ============================================================
    // REGISTER
    // ============================================================
    async register(nome, email, senha, telefone = '') {
        try {
            // Verificar se já existe
            const users = db.getAll('usuarios');
            if (users.find(u => u.email === email)) {
                throw new Error('Email já cadastrado');
            }

            // Criar usuário
            const hash = btoa(senha + 'kanawa_salt');
            const user = {
                nome: nome,
                email: email,
                telefone: telefone,
                senha_hash: hash,
                perfil: 'admin',
                status: 'Ativo',
                criado_em: new Date().toISOString()
            };

            const result = db.insert('usuarios', user);
            return result;

        } catch (error) {
            console.error('❌ Erro no registro:', error);
            throw error;
        }
    },

    // ============================================================
    // LOGOUT
    // ============================================================
    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        return true;
    },

    // ============================================================
    // VERIFICAR SESSÃO
    // ============================================================
    checkAuth() {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('auth_user');

        if (token && user) {
            try {
                return JSON.parse(user);
            } catch {
                return null;
            }
        }
        return null;
    },

    // ============================================================
    // PERMISSÕES
    // ============================================================
    hasPermission(user, permission) {
        if (!user) return false;

        const permissions = {
            admin: ['*'],
            gerente: ['dashboard', 'pdv', 'vendas', 'clientes', 'produtos', 'relatorios'],
            vendedor: ['dashboard', 'pdv', 'vendas', 'clientes'],
            estoquista: ['dashboard', 'produtos', 'movimentacoes', 'transferencias']
        };

        const userPermissions = permissions[user.perfil] || [];
        return userPermissions.includes('*') || userPermissions.includes(permission);
    },

    // ============================================================
    // RESETAR SENHA
    // ============================================================
    async resetPassword(email) {
        const users = db.getAll('usuarios');
        const user = users.find(u => u.email === email);

        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        const novaSenha = Math.random().toString(36).slice(-8);
        const hash = btoa(novaSenha + 'kanawa_salt');

        user.senha_hash = hash;
        db.update('usuarios', user.id, user);

        return novaSenha;
    },

    // ============================================================
    // ALTERAR SENHA
    // ============================================================
    async changePassword(userId, oldPassword, newPassword) {
        const user = db.get('usuarios', userId);

        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        const oldHash = btoa(oldPassword + 'kanawa_salt');
        if (user.senha_hash !== oldHash) {
            throw new Error('Senha atual incorreta');
        }

        const newHash = btoa(newPassword + 'kanawa_salt');
        user.senha_hash = newHash;
        db.update('usuarios', userId, user);

        return true;
    }
};

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.auth = AUTH;
}

console.log('✅ auth.js carregado!');