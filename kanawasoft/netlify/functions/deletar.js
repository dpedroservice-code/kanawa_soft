// netlify/functions/deletar.js
// Deleta dados do PostgreSQL

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

exports.handler = async (event) => {
    if (event.httpMethod !== "DELETE") {
        return {
            statusCode: 405,
            body: JSON.stringify({ sucesso: false, erro: "Método não permitido. Use DELETE." })
        };
    }

    try {
        const { tabela, id } = event.queryStringParameters || {};

        if (!tabela || !id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Parâmetros 'tabela' e 'id' são obrigatórios" })
            };
        }

        const tabelasPermitidas = {
            usuarios: 'usuarios',
            produtos: 'produtos',
            clientes: 'clientes',
            vendas: 'vendas',
            orcamentos: 'orcamentos',
            contas: 'contas',
            movimentacoes: 'movimentacoes',
            categorias: 'categorias',
            transferencias: 'transferencias',
            devolucoes: 'devolucoes',
            notas_fiscais: 'notas_fiscais'
        };

        const tabelaNome = tabelasPermitidas[tabela];
        if (!tabelaNome) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Tabela não permitida" })
            };
        }

        const query = `DELETE FROM ${tabelaNome} WHERE id = $1 RETURNING id`;
        const resultado = await pool.query(query, [id]);

        if (resultado.rows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ sucesso: false, erro: "Registro não encontrado" })
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                sucesso: true,
                mensagem: "Registro deletado com sucesso!"
            })
        };

    } catch (error) {
        console.error('❌ Erro no deletar.js:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: error.message || "Erro interno do servidor"
            })
        };
    }
};