// ============================================================
// KANAWASOFT ERP - APP.JS COMPLETO
// ============================================================
// Versão 3.0.0 - PostgreSQL (Aiven)
// ============================================================

// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
const state = {
    currentUser: null,
    cart: [],
    editingProductId: null,
    editingClientId: null,
    editingBudgetId: null,
    editingContaId: null,
    editingUserId: null,
    editingCategoriaId: null,
    editingFornecedorId: null,
    editingCompraId: null,
    editingFuncionarioId: null,
    editingProjetoId: null,
    editingAtendimentoId: null,
    editingTransportadoraId: null,
    editingCampanhaId: null,
    editingFilialId: null,
    _currentSale: null,
    notifications: [],
    notifCount: 0,
    isOffline: false,
    isSyncing: false,
    syncQueue: []
};

// ============================================================
// CONFIGURAÇÃO DA API
// ============================================================
const API = {
    base: '/.netlify/functions',
    headers: () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`
    })
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    showToast('🔄 Inicializando KanawaSoft ERP...', 'info');

    // Carregar token
    const token = localStorage.getItem('admin_token');
    if (token) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    }

    // Verificar conexão
    updateConnectionStatus();

    // Carregar dados
    await carregarDadosIniciais();

    // Verificar usuários
    if (db.usuarios && db.usuarios.length === 0) {
        showRegister();
        document.getElementById('registerSuccess').textContent = '📝 Crie sua conta para começar!';
        document.getElementById('registerSuccess').classList.add('show');
    } else {
        showLogin();
    }

    // Iniciar serviços automáticos
    iniciarServicosAutomaticos();

    console.log('🚀 KanawaSoft ERP iniciado!');
});

// ============================================================
// CONEXÃO
// ============================================================
function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');
    const status = document.getElementById('dbStatus');

    if (isOnline) {
        dot.className = 'sync-dot online';
        label.textContent = 'Online';
        if (status) status.textContent = '☁️ Online';
    } else {
        dot.className = 'sync-dot offline';
        label.textContent = 'Offline';
        if (status) status.textContent = '💾 Offline';
    }
    state.isOffline = !isOnline;
}

window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('🔄 Conexão restaurada!', 'success');
    syncNow();
});

window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast('⚠️ Você está offline. Os dados serão sincronizados quando a conexão for restaurada.', 'warning');
});

// ============================================================
// CARREGAR DADOS INICIAIS
// ============================================================
async function carregarDadosIniciais() {
    try {
        // Carregar do localStorage primeiro
        const tables = ['usuarios', 'empresa', 'clientes', 'produtos', 'vendas', 
                       'orcamentos', 'contas', 'movimentacoes', 'transferencias',
                       'categorias', 'notas_fiscais', 'devolucoes', 'logs',
                       'fornecedores', 'pedidos_compra', 'funcionarios', 'projetos',
                       'atendimentos', 'transportadoras', 'entregas', 'marketing', 'filiais'];

        for (const table of tables) {
            const data = localStorage.getItem(`kanawasoft_${table}`);
            if (data) {
                db[table] = JSON.parse(data);
            } else {
                db[table] = [];
            }
        }

        // Carregar empresa
        const empresaData = localStorage.getItem('kanawasoft_empresa');
        if (empresaData) {
            db.empresa = JSON.parse(empresaData);
        }

        console.log('✅ Dados locais carregados');

        // Tentar carregar do servidor se estiver online
        if (navigator.onLine) {
            await carregarDoServidor();
        }

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

async function carregarDoServidor() {
    try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const tables = ['usuarios', 'clientes', 'produtos', 'vendas', 'contas', 
                       'categorias', 'fornecedores', 'funcionarios', 'projetos'];

        for (const table of tables) {
            const response = await fetch(`${API.base}/carregar?tabela=${table}&limite=500`, {
                headers: API.headers()
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.sucesso && result.dados) {
                    db[table] = result.dados;
                    localStorage.setItem(`kanawasoft_${table}`, JSON.stringify(result.dados));
                }
            }
        }

        // Carregar empresa
        const empresaResponse = await fetch(`${API.base}/carregar?tabela=empresa`, {
            headers: API.headers()
        });
        if (empresaResponse.ok) {
            const result = await empresaResponse.json();
            if (result.sucesso && result.dados && result.dados.length > 0) {
                db.empresa = result.dados[0];
                localStorage.setItem('kanawasoft_empresa', JSON.stringify(result.dados[0]));
            }
        }

        console.log('✅ Dados sincronizados com o servidor');
        updateUI();

    } catch (error) {
        console.log('⚠️ Erro ao carregar do servidor:', error.message);
    }
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const error = document.getElementById('authError');
    const success = document.getElementById('authSuccess');

    error.classList.remove('show');
    success.classList.remove('show');

    if (!email || !password) {
        error.textContent = 'Preencha todos os campos';
        error.classList.add('show');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Entrando...';

    try {
        // Verificar no banco local primeiro
        const user = db.usuarios.find(u => u.email === email);
        
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        // Verificar senha (simplificado - em produção use bcrypt)
        const senhaHash = btoa(password + 'kanawa_salt');
        if (user.senha_hash !== senhaHash) {
            throw new Error('Senha incorreta');
        }

        if (user.status !== 'Ativo') {
            throw new Error('Usuário inativo');
        }

        state.currentUser = user;
        localStorage.setItem('admin_token', 'admin_' + Date.now());
        localStorage.setItem('user', JSON.stringify(user));

        success.textContent = '✅ Login realizado com sucesso!';
        success.classList.add('show');

        setTimeout(() => startApp(), 500);

    } catch (err) {
        error.textContent = err.message || 'Erro ao fazer login';
        error.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerPasswordConfirm').value;
    const btn = document.getElementById('registerBtn');
    const error = document.getElementById('registerError');
    const success = document.getElementById('registerSuccess');

    error.classList.remove('show');
    success.classList.remove('show');

    if (!name || !email || !password) {
        error.textContent = 'Preencha todos os campos obrigatórios';
        error.classList.add('show');
        return;
    }

    if (password !== confirm) {
        error.textContent = 'As senhas não coincidem';
        error.classList.add('show');
        return;
    }

    if (password.length < 6) {
        error.textContent = 'A senha deve ter no mínimo 6 caracteres';
        error.classList.add('show');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Criando conta...';

    try {
        // Verificar se já existe
        if (db.usuarios.find(u => u.email === email)) {
            throw new Error('Email já cadastrado');
        }

        const senhaHash = btoa(password + 'kanawa_salt');
        const newUser = {
            id: db.usuarios.length + 1,
            nome: name,
            email: email,
            telefone: phone,
            senha_hash: senhaHash,
            perfil: 'admin',
            status: 'Ativo',
            criado_em: new Date().toISOString()
        };

        db.usuarios.push(newUser);
        localStorage.setItem('kanawasoft_usuarios', JSON.stringify(db.usuarios));

        // Tentar salvar no servidor
        if (navigator.onLine) {
            await fetch(`${API.base}/salvar`, {
                method: 'POST',
                headers: API.headers(),
                body: JSON.stringify({
                    tabela: 'usuarios',
                    dados: newUser
                })
            });
        }

        success.textContent = '✅ Conta criada com sucesso!';
        success.classList.add('show');

        setTimeout(() => {
            showLogin();
            document.getElementById('loginEmail').value = email;
            document.getElementById('authSuccess').textContent = '✅ Conta criada! Faça login.';
            document.getElementById('authSuccess').classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Criar Conta';
        }, 800);

    } catch (err) {
        error.textContent = err.message || 'Erro ao criar conta';
        error.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Criar Conta';
    }
}

function showLogin() {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('appContainer').classList.add('app-hidden');
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authSuccess').classList.remove('show');
}

function showRegister() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'flex';
    document.getElementById('appContainer').classList.add('app-hidden');
    document.getElementById('registerError').classList.remove('show');
    document.getElementById('registerSuccess').classList.remove('show');
}

// ============================================================
// INICIAR APP
// ============================================================
function startApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('appContainer').classList.remove('app-hidden');

    if (state.currentUser) {
        const hour = new Date().getHours();
        let greeting = '👋 Olá';
        if (hour < 12) greeting = '🌅 Bom dia';
        else if (hour < 18) greeting = '🌤️ Boa tarde';
        else greeting = '🌙 Boa noite';

        document.getElementById('welcomeMessage').textContent = `${greeting}, ${state.currentUser.nome}!`;
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.getElementById('sideUserName').textContent = state.currentUser.nome;
        document.getElementById('sideUserEmail').textContent = state.currentUser.email;
        document.getElementById('sideUserStatus').textContent = '🟢 Online';
        document.getElementById('sideAvatar').textContent = state.currentUser.nome.charAt(0).toUpperCase();
    }

    // Atualizar todos os módulos
    updateUI();
    updateDashboard();
    updatePDVProducts();
    updateProductsList();
    updateClientsList();
    updateVendasList();
    updateBudgetsList();
    updateMovimentacoesList();
    updateContasList();
    updateUsersList();
    updateCategoriasList();
    updateTransferenciasList();
    updateDevolucoesList();
    updateNotasFiscaisList();
    updateFinanceiroStats();
    updateCaixaStats();
    updateFluxoResumo();
    updateFornecedoresList();
    updatePedidosCompraList();
    updateFuncionariosList();
    updatePontosList();
    updateProjetosList();
    updateAtendimentosList();
    updateTransportadorasList();
    updateEntregasList();
    updateMarketingList();
    updateFiliaisList();
    updateDatabaseStats();

    // Carregar selects
    loadCategoriasSelect();
    loadFornecedoresSelect();
    loadClientesSelect();
    loadFuncionariosSelect();

    navigateTo('dashboard');
    showToast('🚀 Bem-vindo ao KanawaSoft ERP!', 'success');
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navigateTo(page) {
    document.querySelectorAll('.page-section').forEach(el => {
        el.classList.remove('active');
    });

    const target = document.getElementById(`page-${page}`);
    if (target) {
        target.classList.add('active');
    }

    document.querySelectorAll('.sidenav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Atualizar conteúdo da página
    switch (page) {
        case 'dashboard':
            updateDashboard();
            updateCharts();
            break;
        case 'pdv':
            updatePDVProducts();
            updateCart();
            break;
        case 'produtos':
            loadCategoriasSelect();
            updateProductsList();
            break;
        case 'clientes':
            updateClientsList();
            break;
        case 'vendas':
            updateVendasList();
            break;
        case 'orcamentos':
            updateBudgetsList();
            break;
        case 'movimentacoes':
            updateMovimentacoesList();
            break;
        case 'financeiro':
            updateContasList();
            updateFinanceiroStats();
            break;
        case 'caixa':
            updateCaixaStats();
            break;
        case 'fluxo-caixa':
            updateFluxoResumo();
            updateFluxoCaixaChart();
            break;
        case 'config-empresa':
            loadCompanySettings();
            break;
        case 'perfis-usuarios':
            updateUsersList();
            break;
        case 'database':
            updateDatabaseStats();
            break;
        case 'categorias':
            updateCategoriasList();
            break;
        case 'fornecedores':
            updateFornecedoresList();
            break;
        case 'compras':
            updatePedidosCompraList();
            break;
        case 'rh':
            updateFuncionariosList();
            break;
        case 'ponto':
            updatePontosList();
            loadFuncionariosSelect();
            break;
        case 'projetos':
            updateProjetosList();
            break;
        case 'crm':
            updateAtendimentosList();
            loadClientesSelect();
            break;
        case 'logistica':
            updateTransportadorasList();
            break;
        case 'entregas':
            updateEntregasList();
            break;
        case 'marketing':
            updateMarketingList();
            break;
        case 'multiloja':
            updateFiliaisList();
            break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidenav() {
    const sidenav = document.getElementById('sidenav');
    const overlay = document.getElementById('sidenavOverlay');
    if (sidenav.classList.contains('open')) {
        sidenav.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        sidenav.classList.add('open');
        overlay.classList.add('active');
    }
}

// ============================================================
// SINCRONIZAÇÃO
// ============================================================
async function syncNow() {
    if (state.isSyncing) {
        showToast('⏳ Sincronização em andamento...', 'info');
        return;
    }

    if (state.isOffline) {
        showToast('⚠️ Você está offline. Conecte-se à internet para sincronizar.', 'warning');
        return;
    }

    state.isSyncing = true;
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        await carregarDoServidor();
        updateUI();
        showToast('✅ Dados sincronizados com sucesso!', 'success');
    } catch (error) {
        showToast('❌ Erro na sincronização: ' + error.message, 'error');
    } finally {
        state.isSyncing = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync"></i>';
    }
}

// ============================================================
// SERVIÇOS AUTOMÁTICOS
// ============================================================
function iniciarServicosAutomaticos() {
    // Sincronizar a cada 5 minutos
    setInterval(() => {
        if (!state.isOffline && !state.isSyncing) {
            carregarDoServidor().catch(() => {});
        }
    }, 300000);

    // Verificar estoque baixo a cada 30 minutos
    setInterval(() => {
        verificarEstoqueBaixo();
    }, 1800000);

    // Verificar contas vencidas diariamente
    setInterval(() => {
        verificarContasVencidas();
    }, 86400000);

    // Atualizar dashboard a cada minuto
    setInterval(() => {
        if (document.getElementById('page-dashboard').classList.contains('active')) {
            updateDashboard();
        }
    }, 60000);
}

// ============================================================
// VERIFICAÇÕES
// ============================================================
function verificarEstoqueBaixo() {
    const produtos = db.produtos || [];
    const baixo = produtos.filter(p => p.estoque <= (p.estoque_minimo || 5));

    if (baixo.length > 0) {
        const msg = `⚠️ ${baixo.length} produto(s) com estoque baixo!`;
        addNotification('Estoque Baixo', msg, 'warning');
        showToast(msg, 'warning');
    }
}

function verificarContasVencidas() {
    const contas = db.contas || [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencidas = contas.filter(c => {
        if (c.status !== 'Pendente') return false;
        const venc = new Date(c.data_vencimento);
        venc.setHours(0, 0, 0, 0);
        return venc < hoje;
    });

    if (vencidas.length > 0) {
        const msg = `⚠️ ${vencidas.length} conta(s) vencida(s)!`;
        addNotification('Contas Vencidas', msg, 'error');
        showToast(msg, 'error');
    }
}

// ============================================================
// UI UPDATES
// ============================================================
function updateUI() {
    updateBadges();
    updateStatus();
}

function updateBadges() {
    const productBadge = document.getElementById('productBadge');
    if (productBadge) {
        productBadge.textContent = db.produtos?.length || 0;
    }

    const clientBadge = document.getElementById('clientBadge');
    if (clientBadge) {
        clientBadge.textContent = db.clientes?.length || 0;
    }

    const salesBadge = document.getElementById('salesBadge');
    if (salesBadge) {
        salesBadge.textContent = db.vendas?.length || 0;
    }

    const dbStatus = document.getElementById('dbStatus');
    if (dbStatus) {
        dbStatus.textContent = state.isOffline ? '💾 Offline' : '☁️ Online';
        dbStatus.className = `status-badge ${state.isOffline ? 'offline' : 'online'}`;
    }
}

function updateStatus() {
    const companyBadge = document.getElementById('companyBadge');
    if (companyBadge && db.empresa) {
        companyBadge.textContent = `🏢 ${db.empresa.nome || 'Empresa'}`;
    }
}

// ============================================================
// FUNÇÕES DE CARGA DE SELECTS
// ============================================================
function loadCategoriasSelect() {
    const select = document.getElementById('productCategory');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    (db.categorias || []).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
}

function loadFornecedoresSelect() {
    const select = document.getElementById('compraFornecedor');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um fornecedor</option>';
    (db.fornecedores || []).forEach(f => {
        select.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
}

function loadClientesSelect() {
    const select = document.getElementById('atendimentoCliente');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um cliente</option>';
    (db.clientes || []).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
}

function loadFuncionariosSelect() {
    const select = document.getElementById('pontoFuncionario');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um funcionário</option>';
    (db.funcionarios || []).filter(f => f.status === 'Ativo').forEach(f => {
        select.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    toast.innerHTML = `
        <span>${icons[type] || 'ℹ️'}</span>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 4000);
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================
function addNotification(title, body, type = 'info') {
    const notification = {
        id: Date.now(),
        title,
        body,
        type,
        data: new Date().toISOString(),
        lida: false
    };

    state.notifications.push(notification);
    updateNotificationBadge();

    // Notificação nativa
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icons/icon-192x192.png' });
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (badge) {
        const count = state.notifications.filter(n => !n.lida).length;
        badge.textContent = count;
    }
}

function toggleNotificacoes() {
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        updateNotificacoesList();
    }
}

function updateNotificacoesList() {
    const list = document.getElementById('notifList');
    const notifs = state.notifications.slice(0, 20);

    if (notifs.length === 0) {
        list.innerHTML = '<div class="notif-empty">Nenhuma notificação</div>';
        return;
    }

    list.innerHTML = notifs.map(n => `
        <div class="notif-item" onclick="markNotificationRead('${n.id}')">
            <div class="notif-icon ${n.type}">
                <i class="fas ${n.type === 'success' ? 'fa-check' : n.type === 'warning' ? 'fa-exclamation-triangle' : n.type === 'error' ? 'fa-times' : 'fa-info'}"></i>
            </div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-body">${n.body}</div>
                <div class="notif-time">${new Date(n.data).toLocaleString('pt-BR')}</div>
            </div>
        </div>
    `).join('');
}

function markNotificationRead(id) {
    const notif = state.notifications.find(n => n.id == id);
    if (notif) {
        notif.lida = true;
        updateNotificationBadge();
        updateNotificacoesList();
    }
}

function clearNotifications() {
    state.notifications = [];
    updateNotificationBadge();
    document.getElementById('notifList').innerHTML = '<div class="notif-empty">Nenhuma notificação</div>';
    showToast('🧹 Notificações limpas', 'info');
}

// ============================================================
// MODAL
// ============================================================
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// ============================================================
// TEMA
// ============================================================
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    showToast(isDark ? '🌙 Modo escuro ativado' : '☀️ Modo claro ativado', 'info');
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        state.currentUser = null;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('user');
        showToast('👋 Até logo!', 'info');
        setTimeout(() => window.location.reload(), 1000);
    }
}

// ============================================================
// REFRESH
// ============================================================
function refreshData() {
    showToast('🔄 Atualizando dados...', 'info');
    carregarDadosIniciais().then(() => {
        updateUI();
        updateDashboard();
        showToast('✅ Dados atualizados!', 'success');
    });
}

// ============================================================
// ATALHOS DE TECLADO
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('notifPanel').classList.remove('open');
    }

    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        syncNow();
    }

    if (e.key === 'F1') {
        e.preventDefault();
        showToast('📖 Ajuda: Ctrl+S para sincronizar, ESC para fechar modais', 'info');
    }
});

// ============================================================
// EXPORTAÇÕES GLOBAIS
// ============================================================
window.db = {
    usuarios: [],
    empresa: null,
    clientes: [],
    produtos: [],
    vendas: [],
    orcamentos: [],
    contas: [],
    movimentacoes: [],
    transferencias: [],
    categorias: [],
    notas_fiscais: [],
    devolucoes: [],
    logs: [],
    fornecedores: [],
    pedidos_compra: [],
    funcionarios: [],
    pontos: [],
    projetos: [],
    atendimentos: [],
    transportadoras: [],
    entregas: [],
    marketing: [],
    filiais: []
};

// Funções globais
window.navigateTo = navigateTo;
window.toggleSidenav = toggleSidenav;
window.toggleTheme = toggleTheme;
window.logout = logout;
window.syncNow = syncNow;
window.refreshData = refreshData;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleNotificacoes = toggleNotificacoes;
window.clearNotifications = clearNotifications;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.showLogin = showLogin;
window.showRegister = showRegister;
window.addNotification = addNotification;
window.markNotificationRead = markNotificationRead;

console.log('✅ app.js carregado com sucesso!');
console.log('📦 Dados locais:',
    `Usuários: ${db.usuarios.length}`,
    `Produtos: ${db.produtos.length}`,
    `Clientes: ${db.clientes.length}`,
    `Vendas: ${db.vendas.length}`
);