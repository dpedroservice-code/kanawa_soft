// ============================================================
// KANAWASOFT ERP - FINANCEIRO.JS
// ============================================================
// Versão 3.0.0 - Gestão Financeira
// ============================================================

const FINANCEIRO = {
    // ============================================================
    // CONTAS
    // ============================================================
    getContas() {
        return db.getAll('contas');
    },

    getConta(id) {
        return db.get('contas', id);
    },

    getContasByTipo(tipo) {
        return db.getAll('contas').filter(c => c.tipo === tipo);
    },

    getContasByStatus(status) {
        return db.getAll('contas').filter(c => c.status === status);
    },

    getContasVencidas() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return db.getAll('contas').filter(c => {
            if (c.status !== 'Pendente') return false;
            const venc = new Date(c.data_vencimento);
            venc.setHours(0, 0, 0, 0);
            return venc < hoje;
        });
    },

    getContasProximasVencimento(dias = 7) {
        const hoje = new Date();
        const futuro = new Date(hoje);
        futuro.setDate(hoje.getDate() + dias);
        
        return db.getAll('contas').filter(c => {
            if (c.status !== 'Pendente') return false;
            const venc = new Date(c.data_vencimento);
            return venc >= hoje && venc <= futuro;
        });
    },

    // ============================================================
    // SALDOS
    // ============================================================
    getSaldo() {
        const contas = db.getAll('contas');
        const totalReceber = contas
            .filter(c => c.tipo === 'receber' && c.status === 'Pago')
            .reduce((s, c) => s + (c.valor || 0), 0);
        const totalPagar = contas
            .filter(c => c.tipo === 'pagar' && c.status === 'Pago')
            .reduce((s, c) => s + (c.valor || 0), 0);
        return totalReceber - totalPagar;
    },

    getSaldoPendente() {
        const contas = db.getAll('contas');
        const totalReceber = contas
            .filter(c => c.tipo === 'receber' && c.status === 'Pendente')
            .reduce((s, c) => s + (c.valor || 0), 0);
        const totalPagar = contas
            .filter(c => c.tipo === 'pagar' && c.status === 'Pendente')
            .reduce((s, c) => s + (c.valor || 0), 0);
        return totalReceber - totalPagar;
    },

    // ============================================================
    // OPERAÇÕES
    // ============================================================
    baixarConta(id, dataPagamento = null) {
        const conta = this.getConta(id);
        if (!conta) {
            throw new Error('Conta não encontrada');
        }

        conta.status = 'Pago';
        conta.data_pagamento = dataPagamento || new Date().toISOString().slice(0, 10);

        db.update('contas', id, conta);
        return conta;
    },

    cancelarConta(id) {
        const conta = this.getConta(id);
        if (!conta) {
            throw new Error('Conta não encontrada');
        }

        conta.status = 'Cancelado';
        db.update('contas', id, conta);
        return conta;
    },

    // ============================================================
    // RELATÓRIOS
    // ============================================================
    getResumoFinanceiro() {
        const contas = db.getAll('contas');
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        const entradas = contas.filter(c => {
            const d = new Date(c.data_vencimento);
            return c.tipo === 'receber' && 
                   c.status === 'Pago' &&
                   d.getMonth() === mesAtual && 
                   d.getFullYear() === anoAtual;
        }).reduce((s, c) => s + (c.valor || 0), 0);

        const saidas = contas.filter(c => {
            const d = new Date(c.data_vencimento);
            return c.tipo === 'pagar' && 
                   c.status === 'Pago' &&
                   d.getMonth() === mesAtual && 
                   d.getFullYear() === anoAtual;
        }).reduce((s, c) => s + (c.valor || 0), 0);

        const pendentes = contas
            .filter(c => c.status === 'Pendente')
            .reduce((s, c) => s + (c.valor || 0), 0);

        return {
            entradas: entradas,
            saidas: saidas,
            saldo: entradas - saidas,
            pendentes: pendentes,
            total_contas: contas.length
        };
    }
};

// ============================================================
// FUNÇÕES DE UI
// ============================================================

function updateFinanceiroStats() {
    const contas = db.getAll('contas');
    const totalReceber = contas
        .filter(c => c.tipo === 'receber' && c.status === 'Pendente')
        .reduce((s, c) => s + (c.valor || 0), 0);
    const totalPagar = contas
        .filter(c => c.tipo === 'pagar' && c.status === 'Pendente')
        .reduce((s, c) => s + (c.valor || 0), 0);

    document.getElementById('totalReceber').textContent = `AOA ${totalReceber.toLocaleString()}`;
    document.getElementById('totalPagar').textContent = `AOA ${totalPagar.toLocaleString()}`;
    document.getElementById('saldoFinanceiro').textContent = `AOA ${(totalReceber - totalPagar).toLocaleString()}`;
}

function updateContasList() {
    const container = document.getElementById('contasList');
    const contas = db.getAll('contas');

    if (contas.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma conta registrada</td></tr>`;
        return;
    }

    container.innerHTML = contas.slice(0, 50).map(c => {
        const statusColors = {
            'Pendente': 'var(--warning)',
            'Pago': 'var(--success)',
            'Cancelado': 'var(--danger)',
            'Vencido': 'var(--danger)'
        };
        const color = statusColors[c.status] || 'var(--text-muted)';
        const tipoIcon = c.tipo === 'receber' ? '💰 Receber' : '💸 Pagar';
        const tipoColor = c.tipo === 'receber' ? 'var(--success)' : 'var(--danger)';
        return `
            <tr>
                <td><span style="color:${tipoColor};">${tipoIcon}</span></td>
                <td>${c.descricao}</td>
                <td>AOA ${(c.valor || 0).toLocaleString()}</td>
                <td>${new Date(c.data_vencimento).toLocaleDateString('pt-BR')}</td>
                <td><span style="color:${color};">${c.status || 'Pendente'}</span></td>
                <td>
                    <button onclick="editConta(${c.id})" class="btn-sm btn-primary">✏️</button>
                    ${c.status === 'Pendente' ? `<button onclick="baixarConta(${c.id})" class="btn-sm btn-success">✅</button>` : ''}
                    <button onclick="deleteConta(${c.id})" class="btn-sm btn-danger">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openContaModal() {
    state.editingContaId = null;
    document.getElementById('contaModalTitle').textContent = '💰 Nova Conta';
    document.getElementById('contaTipo').value = 'receber';
    document.getElementById('contaDescricao').value = '';
    document.getElementById('contaValor').value = '';
    document.getElementById('contaVencimento').value = '';
    document.getElementById('contaStatus').value = 'Pendente';
    openModal('contaModal');
}

function editConta(id) {
    const conta = db.get('contas', id);
    if (!conta) return;
    state.editingContaId = id;
    document.getElementById('contaModalTitle').textContent = '✏️ Editar Conta';
    document.getElementById('contaTipo').value = conta.tipo;
    document.getElementById('contaDescricao').value = conta.descricao;
    document.getElementById('contaValor').value = conta.valor;
    document.getElementById('contaVencimento').value = conta.data_vencimento?.slice(0, 10) || '';
    document.getElementById('contaStatus').value = conta.status || 'Pendente';
    openModal('contaModal');
}

function saveConta() {
    const tipo = document.getElementById('contaTipo').value;
    const descricao = document.getElementById('contaDescricao').value.trim();
    const valor = parseFloat(document.getElementById('contaValor').value) || 0;
    const data_vencimento = document.getElementById('contaVencimento').value;
    const status = document.getElementById('contaStatus').value;

    if (!descricao) {
        showToast('❌ Descrição é obrigatória!', 'error');
        return;
    }

    if (!data_vencimento) {
        showToast('❌ Data de vencimento é obrigatória!', 'error');
        return;
    }

    const data = {
        tipo: tipo,
        descricao: descricao,
        valor: valor,
        data_vencimento: data_vencimento,
        status: status
    };

    if (state.editingContaId) {
        db.update('contas', state.editingContaId, data);
        showToast('✅ Conta atualizada!', 'success');
    } else {
        db.insert('contas', data);
        showToast('✅ Conta criada!', 'success');
    }

    closeModal('contaModal');
    updateContasList();
    updateFinanceiroStats();
    updateUI();
}

function baixarConta(id) {
    if (!confirm('Confirmar pagamento desta conta?')) return;

    try {
        FINANCEIRO.baixarConta(id);
        updateContasList();
        updateFinanceiroStats();
        updateCaixaStats();
        showToast('✅ Conta baixada com sucesso!', 'success');
    } catch (error) {
        showToast('❌ Erro ao baixar conta: ' + error.message, 'error');
    }
}

function deleteConta(id) {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
        db.delete('contas', id);
        updateContasList();
        updateFinanceiroStats();
        updateUI();
        showToast('🗑️ Conta excluída', 'info');
    }
}

function updateCaixaStats() {
    const contas = db.getAll('contas');
    const totalRecebido = contas
        .filter(c => c.tipo === 'receber' && c.status === 'Pago')
        .reduce((s, c) => s + (c.valor || 0), 0);
    const totalPago = contas
        .filter(c => c.tipo === 'pagar' && c.status === 'Pago')
        .reduce((s, c) => s + (c.valor || 0), 0);

    document.getElementById('saldoCaixa').textContent = `AOA ${(totalRecebido - totalPago).toLocaleString()}`;
    document.getElementById('saldoBancario').textContent = `AOA ${(totalRecebido - totalPago).toLocaleString()}`;

    const container = document.getElementById('movimentacoesCaixa');
    const movs = contas.filter(c => c.status === 'Pago').slice(0, 5);
    if (movs.length === 0) {
        container.innerHTML = `<div class="loading">Nenhuma movimentação recente</div>`;
        return;
    }
    container.innerHTML = movs.map(m => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
            <span>${m.descricao}</span>
            <span style="color:${m.tipo === 'receber' ? 'var(--success)' : 'var(--danger)'};">${m.tipo === 'receber' ? '+' : '-'} AOA ${(m.valor || 0).toLocaleString()}</span>
        </div>
    `).join('');
}

function updateFluxoResumo() {
    const contas = db.getAll('contas');
    const hoje = new Date();
    const mesAtual = hoje.getMonth();

    const entradas = contas.filter(c => {
        const d = new Date(c.data_vencimento);
        return d.getMonth() === mesAtual && c.tipo === 'receber' && c.status === 'Pago';
    }).reduce((s, c) => s + (c.valor || 0), 0);

    const saidas = contas.filter(c => {
        const d = new Date(c.data_vencimento);
        return d.getMonth() === mesAtual && c.tipo === 'pagar' && c.status === 'Pago';
    }).reduce((s, c) => s + (c.valor || 0), 0);

    const pendentes = contas
        .filter(c => c.status === 'Pendente')
        .reduce((s, c) => s + (c.valor || 0), 0);

    document.getElementById('fluxoEntradas').textContent = `AOA ${entradas.toLocaleString()}`;
    document.getElementById('fluxoSaidas').textContent = `AOA ${saidas.toLocaleString()}`;
    document.getElementById('fluxoSaldo').textContent = `AOA ${(entradas - saidas).toLocaleString()}`;
    document.getElementById('fluxoPendentes').textContent = `AOA ${pendentes.toLocaleString()}`;
}

function gerarFluxoCaixa(periodo) {
    showToast(`📊 Fluxo de caixa ${periodo} atualizado!`, 'info');
    updateFluxoCaixaChart();
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.FINANCEIRO = FINANCEIRO;
    window.updateFinanceiroStats = updateFinanceiroStats;
    window.updateContasList = updateContasList;
    window.openContaModal = openContaModal;
    window.editConta = editConta;
    window.saveConta = saveConta;
    window.baixarConta = baixarConta;
    window.deleteConta = deleteConta;
    window.updateCaixaStats = updateCaixaStats;
    window.updateFluxoResumo = updateFluxoResumo;
    window.gerarFluxoCaixa = gerarFluxoCaixa;
}

console.log('✅ financeiro.js carregado!');