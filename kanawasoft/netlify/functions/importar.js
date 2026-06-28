// netlify/functions/importar.js
// Importação de dados

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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
        const { dados, tipo, sobreescrever = false } = body;

        if (!dados || !Array.isArray(dados) || dados.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    sucesso: false,
                    erro: "Dados inválidos ou vazios"
                })
            };
        }

        let importados = 0;
        let erros = [];

        // Mapear tipo para tabela
        const tabelaMap = {
            produtos: 'products',
            clientes: 'clients',
            vendas: 'sales',
            usuarios: 'users',
            contas: 'contas'
        };

        const tabela = tabelaMap[tipo];
        if (!tabela) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    sucesso: false,
                    erro: "Tipo de importação não suportado"
                })
            };
        }

        // Se sobreescrever, limpar tabela
        if (sobreescrever) {
            await pool.query(`DELETE FROM ${tabela}`);
        }

        // Importar dados
        for (const item of dados) {
            try {
                const keys = Object.keys(item);
                const values = Object.values(item);
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                
                const query = `
                    INSERT INTO ${tabela} (${keys.join(', ')})
                    VALUES (${placeholders})
                    ON CONFLICT (id) DO UPDATE SET
                    ${keys.map(k => `${k} = EXCLUDED.${k}`).join(', ')}
                `;

                await pool.query(query, values);
                importados++;
            } catch (error) {
                erros.push({
                    item: item,
                    erro: error.message
                });
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                sucesso: true,
                importados: importados,
                erros: erros,
                total: dados.length,
                mensagem: `${importados} registros importados com sucesso`
            })
        };

    } catch (error) {
        console.error('❌ Erro na importação:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: error.message
            })
        };
    }
};