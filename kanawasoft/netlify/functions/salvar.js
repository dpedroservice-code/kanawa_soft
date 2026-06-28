// netlify/functions/salvar.js
// Salva dados no PostgreSQL da Aiven

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
        rejectUnauthorized: false,
        sslmode: 'require'
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// ============================================================
// VALIDAÇÕES
// ============================================================
function validarDados(tabela, dados) {
    const validacoes = {
        produtos: ['nome', 'codigo'],
        clientes: ['nome'],
        vendas: ['invoice', 'cliente_nome', 'total'],
        orcamentos: ['numero', 'cliente', 'valor'],
        contas: ['tipo', 'descricao', 'valor', 'data_vencimento'],
        usuarios: ['nome', 'email', 'senha_hash'],
        categorias: ['nome'],
        transferencias: ['produto_id', 'quantidade', 'origem', 'destino'],
        devolucoes: ['numero', 'cliente_nome', 'valor'],
        notas_fiscais: ['numero', 'cliente_nome', 'total']
    };

    const campos = validacoes[tabela] || [];
    for (const campo of campos) {
        if (!dados[campo] && dados[campo] !== 0) {
            throw new Error(`Campo '${campo}' é obrigatório`);
        }
    }

    return true;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ sucesso: false, erro: "Método não permitido. Use POST." })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { tabela, dados, id } = body;

        if (!tabela) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Parâmetro 'tabela' é obrigatório" })
            };
        }

        if (!dados) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Parâmetro 'dados' é obrigatório" })
            };
        }

        validarDados(tabela, dados);

        const tabelasPermitidas = {
            usuarios: 'usuarios',
            empresa: 'empresa',
            produtos: 'produtos',
            clientes: 'clientes',
            vendas: 'vendas',
            orcamentos: 'orcamentos',
            contas: 'contas',
            movimentacoes: 'movimentacoes',
            categorias: 'categorias',
            transferencias: 'transferencias',
            devolucoes: 'devolucoes',
            notas_fiscais: 'notas_fiscais',
            logs_auditoria: 'logs_auditoria'
        };

        const tabelaNome = tabelasPermitidas[tabela];
        if (!tabelaNome) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Tabela não permitida" })
            };
        }

        let resultado;

        if (id) {
            const keys = Object.keys(dados);
            const values = Object.values(dados);
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const query = `UPDATE ${tabelaNome} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`;
            
            resultado = await pool.query(query, [...values, id]);

            if (resultado.rows.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ sucesso: false, erro: "Registro não encontrado" })
                };
            }
        } else {
            const keys = Object.keys(dados);
            const values = Object.values(dados);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO ${tabelaNome} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
            
            resultado = await pool.query(query, values);
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                sucesso: true,
                dados: resultado.rows[0],
                mensagem: id ? "Registro atualizado com sucesso!" : "Registro criado com sucesso!"
            })
        };

    } catch (error) {
        console.error('❌ Erro no salvar.js:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: error.message || "Erro interno do servidor"
            })
        };
    }
};