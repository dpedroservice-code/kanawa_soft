// ============================================================
// KANAWASOFT ERP - BACKUP.JS
// ============================================================
// Versão 3.0.0 - Sistema de Backup
// ============================================================

const BACKUP = {
    // ============================================================
    // CRIAR BACKUP
    // ============================================================
    create() {
        const tables = [
            'usuarios', 'empresa', 'clientes', 'produtos', 'vendas',
            'orcamentos', 'contas', 'movimentacoes', 'transferencias',
            'categorias', 'notas_fiscais', 'devolucoes', 'logs',
            'fornecedores', 'pedidos_compra', 'funcionarios', 'pontos',
            'projetos', 'atendimentos', 'transportadoras', 'entregas',
            'marketing', 'filiais'
        ];

        const backup = {};
        let totalRecords = 0;

        for (const table of tables) {
            const data = db.getAll(table);
            backup[table] = data;
            totalRecords += data.length;
        }

        const backupData = {
            timestamp: new Date().toISOString(),
            versao: '3.0.0',
            total_registros: totalRecords,
            dados: backup
        };

        // Salvar no localStorage
        localStorage.setItem('kanawasoft_backup', JSON.stringify(backupData));

        // Salvar como arquivo
        this.download(backupData);

        // Registrar no log
        this.log('backup_criado', { total: totalRecords });

        return backupData;
    },

    // ============================================================
    // RESTAURAR BACKUP
    // ============================================================
    restore(backupData) {
        if (!backupData || !backupData.dados) {
            throw new Error('Dados de backup inválidos');
        }

        if (!confirm('⚠️ Isso irá sobrescrever todos os dados atuais. Continuar?')) {
            return false;
        }

        const tables = Object.keys(backupData.dados);
        let totalRestaurados = 0;

        for (const table of tables) {
            if (db[table] !== undefined) {
                db[table] = backupData.dados[table];
                db.saveToLocalStorage(table);
                totalRestaurados += backupData.dados[table].length;
            }
        }

        // Restaurar empresa
        if (backupData.dados.empresa && backupData.dados.empresa.length > 0) {
            db.empresa = backupData.dados.empresa[0];
            db.saveEmpresa();
        }

        // Registrar no log
        this.log('backup_restaurado', { 
            total: totalRestaurados,
            data: backupData.timestamp 
        });

        showToast(`✅ Backup restaurado! ${totalRestaurados} registros.`, 'success');
        return true;
    },

    // ============================================================
    // DOWNLOAD
    // ============================================================
    download(backupData) {
        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ============================================================
    // UPLOAD
    // ============================================================
    upload() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('Nenhum arquivo selecionado'));
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        resolve(data);
                    } catch (error) {
                        reject(new Error('Arquivo inválido'));
                    }
                };
                reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
                reader.readAsText(file);
            };
            input.click();
        });
    },

    // ============================================================
    // LOG
    // ============================================================
    log(acao, detalhes) {
        const log = {
            usuario: state.currentUser?.nome || 'Sistema',
            acao: `backup_${acao}`,
            detalhes: JSON.stringify(detalhes),
            data: new Date().toISOString()
        };
        db.insert('logs', log);
    },

    // ============================================================
    // LIMPAR BACKUPS ANTIGOS
    // ============================================================
    cleanOldBackups(maxFiles = 10) {
        // Implementar limpeza de backups antigos
        // (usando localStorage ou arquivos)
        const backups = JSON.parse(localStorage.getItem('kanawasoft_backups') || '[]');
        if (backups.length > maxFiles) {
            const newBackups = backups.slice(-maxFiles);
            localStorage.setItem('kanawasoft_backups', JSON.stringify(newBackups));
        }
    }
};

// ============================================================
// FUNÇÕES DE UI
// ============================================================

function backupDatabase() {
    try {
        const backup = BACKUP.create();
        showToast(`✅ Backup criado! ${backup.total_registros} registros.`, 'success');
        updateDatabaseStats();
    } catch (error) {
        showToast('❌ Erro ao criar backup: ' + error.message, 'error');
    }
}

async function restoreBackup() {
    try {
        const backupData = await BACKUP.upload();
        BACKUP.restore(backupData);
        updateUI();
        updateDatabaseStats();
        showToast('✅ Backup restaurado com sucesso!', 'success');
    } catch (error) {
        showToast('❌ Erro ao restaurar backup: ' + error.message, 'error');
    }
}

function exportDatabase() {
    try {
        const backup = BACKUP.create();
        showToast('📤 Banco de dados exportado!', 'success');
    } catch (error) {
        showToast('❌ Erro ao exportar: ' + error.message, 'error');
    }
}

async function importDatabase() {
    try {
        const backupData = await BACKUP.upload();
        BACKUP.restore(backupData);
        updateUI();
        updateDatabaseStats();
        showToast('📥 Banco de dados importado!', 'success');
    } catch (error) {
        showToast('❌ Erro ao importar: ' + error.message, 'error');
    }
}

async function resetDatabase() {
    if (!confirm('⚠️ Isso irá APAGAR TODOS os dados. Tem certeza?')) return;
    if (!confirm('⚠️ ÚLTIMA CONFIRMAÇÃO: Deseja realmente resetar tudo?')) return;

    try {
        const backup = BACKUP.create();
        
        const tables = [
            'usuarios', 'clientes', 'produtos', 'vendas', 'orcamentos',
            'contas', 'movimentacoes', 'transferencias', 'categorias',
            'notas_fiscais', 'devolucoes', 'logs', 'fornecedores',
            'pedidos_compra', 'funcionarios', 'pontos', 'projetos',
            'atendimentos', 'transportadoras', 'entregas', 'marketing', 'filiais'
        ];

        for (const table of tables) {
            db[table] = [];
            db.saveToLocalStorage(table);
        }

        db.empresa = null;
        db.saveEmpresa();

        // Recriar admin
        const adminUser = {
            id: 1,
            nome: 'Administrador',
            email: 'admin@kanawasoft.com',
            senha_hash: btoa('admin123' + 'kanawa_salt'),
            perfil: 'admin',
            status: 'Ativo',
            criado_em: new Date().toISOString()
        };
        db.insert('usuarios', adminUser);

        updateUI();
        updateDatabaseStats();
        showToast('🗑️ Banco de dados resetado! Backup criado.', 'warning');
    } catch (error) {
        showToast('❌ Erro ao resetar: ' + error.message, 'error');
    }
}

function updateDatabaseStats() {
    const container = document.getElementById('dbStats');
    if (!container) return;

    const stats = db.getStats();
    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    container.innerHTML = Object.entries(stats).map(([key, value]) => `
        <div class="db-stat-item">
            <div class="stat-number">${value}</div>
            <div class="stat-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
        </div>
    `).join('') + `
        <div class="db-stat-item" style="background:var(--primary);color:#fff;">
            <div class="stat-number" style="color:#fff;">${total}</div>
            <div class="stat-label" style="color:rgba(255,255,255,0.8);">Total Registros</div>
        </div>
    `;

    // Atualizar log de atividades
    updateActivityLog();
}

function updateActivityLog() {
    const container = document.getElementById('activityLog');
    if (!container) return;

    const logs = db.getAll('logs').slice(0, 10);
    if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma atividade registrada</div>';
        return;
    }

    container.innerHTML = logs.map(log => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8rem;">
            <span>${log.acao}</span>
            <span style="color:var(--text-muted);">${new Date(log.data).toLocaleString('pt-BR')}</span>
        </div>
    `).join('');
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.BACKUP = BACKUP;
    window.backupDatabase = backupDatabase;
    window.restoreBackup = restoreBackup;
    window.exportDatabase = exportDatabase;
    window.importDatabase = importDatabase;
    window.resetDatabase = resetDatabase;
    window.updateDatabaseStats = updateDatabaseStats;
}

console.log('✅ backup.js carregado!');