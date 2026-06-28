// ============================================================
// KANAWASOFT ERP - DASHBOARD.JS
// ============================================================
// Versão 3.0.0 - Dashboard e Gráficos
// ============================================================

let salesChartInstance = null;
let categoryChartInstance = null;
let cashFlowChartInstance = null;

// ============================================================
// UPDATE DASHBOARD
// ============================================================
function updateDashboard() {
    const vendas = db.getAll('vendas');
    const produtos = db.getAll('produtos');
    const clientes = db.getAll('clientes');

    const totalVendas = vendas.reduce((s, v) => s + (v.total || 0), 0);
    const totalPedidos = vendas.length;

    document.getElementById('totalSales').textContent = `AOA ${totalVendas.toLocaleString()}`;
    document.getElementById('totalOrders').textContent = totalPedidos;
    document.getElementById('totalClients').textContent = clientes.length;
    document.getElementById('totalProducts').textContent = produtos.length;

    // Calcular crescimento
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAtual = hoje.getFullYear();

    const vendasMes = vendas.filter(v => {
        const d = new Date(v.data);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const vendasMesAnterior = vendas.filter(v => {
        const d = new Date(v.data);
        const ano = mesAnterior === 11 ? anoAtual - 1 : anoAtual;
        return d.getMonth() === mesAnterior && d.getFullYear() === ano;
    });

    const totalMes = vendasMes.reduce((s, v) => s + (v.total || 0), 0);
    const totalMesAnterior = vendasMesAnterior.reduce((s, v) => s + (v.total || 0), 0);
    const crescimento = totalMesAnterior > 0 ? ((totalMes - totalMesAnterior) / totalMesAnterior * 100) : 0;

    document.getElementById('salesGrowth').textContent = 
        `${crescimento >= 0 ? '↑' : '↓'} ${Math.abs(crescimento).toFixed(1)}%`;
    document.getElementById('salesGrowth').className = `stat-change ${crescimento >= 0 ? 'positive' : 'negative'}`;

    // Orders growth
    const pedidosMes = vendas.filter(v => {
        const d = new Date(v.data);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const pedidosMesAnterior = vendas.filter(v => {
        const d = new Date(v.data);
        const ano = mesAnterior === 11 ? anoAtual - 1 : anoAtual;
        return d.getMonth() === mesAnterior && d.getFullYear() === ano;
    });
    const growthOrders = pedidosMesAnterior.length > 0 ?
        ((pedidosMes.length - pedidosMesAnterior.length) / pedidosMesAnterior.length * 100) : 0;
    document.getElementById('ordersGrowth').textContent = 
        `${growthOrders >= 0 ? '↑' : '↓'} ${Math.abs(growthOrders).toFixed(1)}%`;
    document.getElementById('ordersGrowth').className = `stat-change ${growthOrders >= 0 ? 'positive' : 'negative'}`;

    // Top 5 produtos
    updateTopProducts();
    updateStockStatus();
    updateRecentActivities();
}

function updateTopProducts() {
    const container = document.getElementById('topProductsList');
    const vendas = db.getAll('vendas');
    const produtos = {};

    for (const venda of vendas) {
        const items = venda.items || [];
        for (const item of items) {
            const nome = item.produto_nome || item.nome;
            if (!produtos[nome]) {
                produtos[nome] = {
                    nome: nome,
                    quantidade: 0,
                    faturamento: 0
                };
            }
            produtos[nome].quantidade += item.quantidade || 1;
            produtos[nome].faturamento += (item.preco_unitario || item.preco || 0) * (item.quantidade || 1);
        }
    }

    const top5 = Object.values(produtos)
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 5);

    if (top5.length === 0) {
        container.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhum produto vendido</td></tr>`;
        return;
    }

    container.innerHTML = top5.map((p, i) => `
        <tr>
            <td>${p.nome}</td>
            <td>${p.quantidade}</td>
            <td>AOA ${p.faturamento.toLocaleString()}</td>
        </tr>
    `).join('');
}

function updateStockStatus() {
    const container = document.getElementById('stockStatus');
    const produtos = db.getAll('produtos');
    const total = produtos.length;
    const baixo = produtos.filter(p => p.estoque <= (p.estoque_minimo || 5)).length;
    const semEstoque = produtos.filter(p => p.estoque === 0).length;

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div style="text-align:center;padding:12px;background:var(--bg);border-radius:8px;">
                <div style="font-size:1.5rem;font-weight:700;color:var(--info);">${total}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);">Total Produtos</div>
            </div>
            <div style="text-align:center;padding:12px;background:#fef3c7;border-radius:8px;">
                <div style="font-size:1.5rem;font-weight:700;color:#d97706;">${baixo}</div>
                <div style="font-size:0.7rem;color:#92400e;">Estoque Baixo</div>
            </div>
            <div style="text-align:center;padding:12px;background:#fee2e2;border-radius:8px;">
                <div style="font-size:1.5rem;font-weight:700;color:#dc2626;">${semEstoque}</div>
                <div style="font-size:0.7rem;color:#991b1b;">Sem Estoque</div>
            </div>
        </div>
    `;
}

function updateRecentActivities() {
    const container = document.getElementById('recentActivities');
    const vendas = db.getAll('vendas').slice(0, 5);
    const movimentacoes = db.getAll('movimentacoes').slice(0, 5);

    const atividades = [];

    for (const v of vendas) {
        atividades.push({
            tipo: 'venda',
            descricao: `Venda ${v.invoice} - ${v.cliente_nome}`,
            valor: v.total,
            data: v.data
        });
    }

    for (const m of movimentacoes) {
        atividades.push({
            tipo: 'movimentacao',
            descricao: `${m.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'} de ${m.produto_nome}`,
            valor: m.quantidade,
            data: m.data
        });
    }

    atividades.sort((a, b) => new Date(b.data) - new Date(a.data));
    const recentes = atividades.slice(0, 5);

    if (recentes.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma atividade recente</div>`;
        return;
    }

    container.innerHTML = recentes.map(a => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
            <span>${a.descricao}</span>
            <span style="font-weight:600;color:var(--primary);">${a.tipo === 'venda' ? 'AOA ' + a.valor.toLocaleString() : a.valor + 'x'}</span>
        </div>
    `).join('');
}

// ============================================================
// GRÁFICOS
// ============================================================
function initCharts() {
    initSalesChart();
    initCategoryChart();
    initCashFlowChart();
}

function initSalesChart() {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();

    const vendas = db.getAll('vendas');
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = labels.map((_, i) => {
        const monthSales = vendas.filter(v => {
            const d = new Date(v.data);
            return d.getMonth() === i;
        });
        return monthSales.reduce((sum, v) => sum + (v.total || 0), 0);
    });

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vendas (AOA)',
                data: data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                borderColor: '#1a3a5c',
                backgroundColor: 'rgba(26, 58, 92, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#1a3a5c',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'AOA ' + (value / 1000) + 'K';
                        }
                    }
                }
            }
        }
    });
}

function updateChart(period) {
    showToast(`📊 Gráfico atualizado para: ${period}`, 'info');
    if (salesChartInstance) {
        const vendas = db.getAll('vendas');
        let labels, data;

        if (period === 'semanal') {
            const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
            const hoje = new Date();
            data = dias.map((_, i) => {
                const d = new Date(hoje);
                d.setDate(hoje.getDate() - (6 - i));
                const daySales = vendas.filter(v => {
                    const vd = new Date(v.data);
                    return vd.toDateString() === d.toDateString();
                });
                return daySales.reduce((sum, v) => sum + (v.total || 0), 0);
            });
            labels = dias;
        } else {
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            data = meses.map((_, i) => {
                const monthSales = vendas.filter(v => {
                    const d = new Date(v.data);
                    return d.getMonth() === i;
                });
                return monthSales.reduce((sum, v) => sum + (v.total || 0), 0);
            });
            labels = meses;
        }

        salesChartInstance.data.labels = labels;
        salesChartInstance.data.datasets[0].data = data;
        salesChartInstance.update();
    }
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    if (categoryChartInstance) categoryChartInstance.destroy();

    const vendas = db.getAll('vendas');
    const produtos = db.getAll('produtos');
    const categorias = {};

    const productMap = {};
    for (const p of produtos) {
        productMap[p.id] = p.categoria_id ? db.get('categorias', p.categoria_id)?.nome || 'Outros' : 'Outros';
    }

    for (const v of vendas) {
        const items = v.items || [];
        for (const item of items) {
            const produto = produtos.find(p => p.id === item.produto_id || p.nome === item.produto_nome);
            const categoria = produto ? productMap[produto.id] : 'Outros';
            if (!categorias[categoria]) categorias[categoria] = 0;
            categorias[categoria] += (item.preco_unitario || item.preco || 0) * (item.quantidade || 1);
        }
    }

    const labels = Object.keys(categorias);
    const dados = Object.values(categorias);
    const cores = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];

    if (labels.length === 0) {
        labels.push('Sem dados');
        dados.push(1);
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
                backgroundColor: cores.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                }
            },
            cutout: '65%'
        }
    });
}

function initCashFlowChart() {
    const ctx = document.getElementById('cashFlowChart')?.getContext('2d');
    if (!ctx) return;
    if (cashFlowChartInstance) cashFlowChartInstance.destroy();

    const contas = db.getAll('contas');
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    const entradas = new Array(6).fill(0);
    const saidas = new Array(6).fill(0);

    for (const c of contas) {
        if (c.status !== 'Pago') continue;
        const d = new Date(c.data_pagamento || c.data_vencimento);
        const mes = d.getMonth();
        if (mes < 6) {
            if (c.tipo === 'receber') entradas[mes] += c.valor || 0;
            else saidas[mes] += c.valor || 0;
        }
    }

    cashFlowChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Entradas',
                data: entradas,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: '#10b981',
                borderWidth: 1
            }, {
                label: 'Saídas',
                data: saidas,
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: '#ef4444',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'AOA ' + (value / 1000) + 'K';
                        }
                    }
                }
            }
        }
    });
}

function updateFluxoCaixaChart() {
    if (cashFlowChartInstance) {
        const contas = db.getAll('contas');
        const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const entradas = new Array(12).fill(0);
        const saidas = new Array(12).fill(0);

        for (const c of contas) {
            if (c.status !== 'Pago') continue;
            const d = new Date(c.data_pagamento || c.data_vencimento);
            const mes = d.getMonth();
            if (c.tipo === 'receber') entradas[mes] += c.valor || 0;
            else saidas[mes] += c.valor || 0;
        }

        cashFlowChartInstance.data.labels = labels;
        cashFlowChartInstance.data.datasets[0].data = entradas;
        cashFlowChartInstance.data.datasets[1].data = saidas;
        cashFlowChartInstance.update();
    }
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.updateDashboard = updateDashboard;
    window.initCharts = initCharts;
    window.updateChart = updateChart;
    window.updateFluxoCaixaChart = updateFluxoCaixaChart;
}

console.log('✅ dashboard.js carregado!');