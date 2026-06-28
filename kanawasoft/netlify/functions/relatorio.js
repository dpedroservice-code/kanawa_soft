// netlify/functions/relatorio.js
// Geração de relatórios

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 3000,
});

// ============================================================
// VERIFICAÇÃO DE ADMIN
// ============================================================
function verificarAdmin(token) {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || !token) return false;

    try {
        return crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(adminToken)
        );
    } catch {
        return false;
    }
}

// ============================================================
// FUNÇÕES DE RELATÓRIO
// ============================================================
async function relatorioVendas(periodo) {
    const query = `
        SELECT 
            COUNT(*) as total_vendas,
            SUM(total) as faturamento,
            AVG(total) as ticket_medio,
            COUNT(DISTINCT client_id) as clientes_unicos,
            MIN(date) as primeira_venda,
            MAX(date) as ultima_venda
        FROM sales
        WHERE date >= CURRENT_DATE - INTERVAL $1
    `;
    const resultado = await pool.query(query, [periodo || '30 days']);

    return resultado.rows[0];
}

async function relatorioProdutos() {
    const query = `
        SELECT 
            p.id,
            p.name,
            p.code,
            p.stock,
            p.price,
            COUNT(si.id) as vendas,
            SUM(si.quantity) as quantidade_vendida,
            SUM(si.total_price) as faturamento
        FROM products p
        LEFT JOIN sale_items si ON p.id = si.product_id
        GROUP BY p.id, p.name, p.code, p.stock, p.price
        ORDER BY faturamento DESC
        LIMIT 20
    `;
    const resultado = await pool.query(query);

    return resultado.rows;
}

async function relatorioFinanceiro() {
    const query = `
        SELECT 
            tipo,
            COUNT(*) as quantidade,
            SUM(valor) as total,
            AVG(valor) as media,
            status
        FROM contas
        GROUP BY tipo, status
    `;
    const resultado = await pool.query(query);

    const totalReceber = resultado.rows
        .filter(r => r.tipo === 'receber' && r.status === 'Pendente')
        .reduce((s, r) => s + parseFloat(r.total), 0);

    const totalPagar = resultado.rows
        .filter(r => r.tipo === 'pagar' && r.status === 'Pendente')
        .reduce((s, r) => s + parseFloat(r.total), 0);

    return {
        detalhes: resultado.rows,
        total_receber: totalReceber,
        total_pagar: totalPagar,
        saldo: totalReceber - totalPagar
    };
}

async function relatorioClientes() {
    const query = `
        SELECT 
            c.id,
            c.name,
            c.email,
            c.phone,
            COUNT(s.id) as total_compras,
            SUM(s.total) as total_gasto,
            AVG(s.total) as ticket_medio,
            MAX(s.date) as ultima_compra
        FROM clients c
        LEFT JOIN sales s ON c.id = s.client_id
        GROUP BY c.id, c.name, c.email, c.phone
        ORDER BY total_gasto DESC
        LIMIT 20
    `;
    const resultado = await pool.query(query);

    return resultado.rows;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ erro: "Método não permitido" })
        };
    }

    const authHeader = event.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!verificarAdmin(token)) {
        return {
            statusCode: 401,
            body: JSON.stringify({ sucesso: false, erro: "Não autorizado" })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { tipo, periodo } = body;

        let resultado = {};

        switch (tipo) {
            case 'vendas':
                resultado = await relatorioVendas(periodo || '30 days');
                break;

            case 'produtos':
                resultado = await relatorioProdutos();
                break;

            case 'financeiro':
                resultado = await relatorioFinanceiro();
                break;

            case 'clientes':
                resultado = await relatorioClientes();
                break;

            case 'completo': {
                const vendas = await relatorioVendas(periodo || '30 days');
                const produtos = await relatorioProdutos();
                const financeiro = await relatorioFinanceiro();
                const clientes = await relatorioClientes();

                resultado = {
                    vendas: vendas,
                    produtos: produtos,
                    financeiro: financeiro,
                    clientes: clientes,
                    gerado_em: new Date().toISOString()
                };
                break;
            }

            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        sucesso: false,
                        erro: "Tipo de relatório não suportado"
                    })
                };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                sucesso: true,
                tipo: tipo,
                periodo: periodo || '30 days',
                dados: resultado
            })
        };

    } catch (error) {
        console.error('❌ Erro no relatório:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: "Erro interno"
            })
        };
    }
};