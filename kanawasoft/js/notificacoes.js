// ============================================================
// KANAWASOFT ERP - NOTIFICACOES.JS
// ============================================================
// Versão 3.0.0 - Sistema de Notificações
// ============================================================

const NOTIFICACOES = {
    notificacoes: [],
    listeners: [],

    // ============================================================
    // ADICIONAR NOTIFICAÇÃO
    // ============================================================
    add(title, body, type = 'info', persist = false) {
        const notification = {
            id: Date.now(),
            title,
            body,
            type,
            data: new Date().toISOString(),
            lida: false,
            persist
        };

        this.notificacoes.push(notification);
        this.notifyListeners('add', notification);

        // Notificação nativa
        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icons/icon-192x192.png' });
        }

        // Atualizar badge
        this.updateBadge();

        return notification;
    },

    // ============================================================
    // MARCAR COMO LIDA
    // ============================================================
    markAsRead(id) {
        const notif = this.notificacoes.find(n => n.id === id);
        if (notif) {
            notif.lida = true;
            this.notifyListeners('read', notif);
            this.updateBadge();
        }
    },

    markAllAsRead() {
        for (const n of this.notificacoes) {
            n.lida = true;
        }
        this.notifyListeners('read_all', null);
        this.updateBadge();
    },

    // ============================================================
    // REMOVER
    // ============================================================
    remove(id) {
        this.notificacoes = this.notificacoes.filter(n => n.id !== id);
        this.notifyListeners('remove', { id });
        this.updateBadge();
    },

    clearAll() {
        this.notificacoes = [];
        this.notifyListeners('clear', null);
        this.updateBadge();
    },

    // ============================================================
    // LISTAR
    // ============================================================
    getAll() {
        return this.notificacoes;
    },

    getUnread() {
        return this.notificacoes.filter(n => !n.lida);
    },

    getByType(type) {
        return this.notificacoes.filter(n => n.type === type);
    },

    // ============================================================
    // BADGE
    // ============================================================
    updateBadge() {
        const badge = document.getElementById('notifBadge');
        if (badge) {
            const count = this.getUnread().length;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    },

    // ============================================================
    // LISTENERS
    // ============================================================
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    },

    notifyListeners(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (error) {
                console.error('❌ Erro no listener:', error);
            }
        }
    }
};

// ============================================================
// FUNÇÕES DE UI
// ============================================================

function updateNotificacoes() {
    const list = document.getElementById('notifList');
    const notifs = NOTIFICACOES.getAll().slice(0, 20);

    if (notifs.length === 0) {
        list.innerHTML = '<div class="notif-empty">Nenhuma notificação</div>';
        return;
    }

    list.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.lida ? 'read' : ''}" onclick="markNotificationRead(${n.id})">
            <div class="notif-icon ${n.type}">
                <i class="fas ${n.type === 'success' ? 'fa-check' : n.type === 'warning' ? 'fa-exclamation-triangle' : n.type === 'error' ? 'fa-times' : 'fa-info'}"></i>
            </div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-body">${n.body}</div>
                <div class="notif-time">${new Date(n.data).toLocaleString('pt-BR')}</div>
            </div>
            ${!n.lida ? `<button onclick="event.stopPropagation();markNotificationRead(${n.id})" class="btn-sm btn-primary">Marcar lida</button>` : ''}
        </div>
    `).join('');
}

function markNotificationRead(id) {
    NOTIFICACOES.markAsRead(id);
    updateNotificacoes();
}

function clearNotifications() {
    NOTIFICACOES.clearAll();
    updateNotificacoes();
    showToast('🧹 Notificações limpas', 'info');
}

// ============================================================
// NOTIFICAÇÕES AUTOMÁTICAS
// ============================================================

function checkAndNotify() {
    // Verificar estoque baixo
    const produtos = db.getAll('produtos');
    const baixo = produtos.filter(p => p.estoque <= (p.estoque_minimo || 5));
    if (baixo.length > 0) {
        NOTIFICACOES.add(
            '⚠️ Estoque Baixo',
            `${baixo.length} produtos com estoque crítico: ${baixo.map(p => p.nome).join(', ')}`,
            'warning'
        );
    }

    // Verificar contas vencendo
    const contas = db.getAll('contas');
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    const vencendo = contas.filter(c => {
        if (c.status !== 'Pendente') return false;
        const venc = new Date(c.data_vencimento);
        return venc.toDateString() === amanha.toDateString();
    });

    if (vencendo.length > 0) {
        NOTIFICACOES.add(
            '📅 Contas Vencendo Amanhã',
            `${vencendo.length} contas vencem amanhã. Total: AOA ${vencendo.reduce((s, c) => s + c.valor, 0).toLocaleString()}`,
            'warning'
        );
    }
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.NOTIFICACOES = NOTIFICACOES;
    window.updateNotificacoes = updateNotificacoes;
    window.markNotificationRead = markNotificationRead;
    window.clearNotifications = clearNotifications;
    window.checkAndNotify = checkAndNotify;
}

console.log('✅ notificacoes.js carregado!');