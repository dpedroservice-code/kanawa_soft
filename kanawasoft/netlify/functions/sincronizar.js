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
// VERIFICAÇÃO DE TOKEN (SEGURA)
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
// LOG
// ============================================================
async function registrarLog(operacao, chave, detalhes, status, ip, userAgent) {
    try {
        await pool.query(
            `INSERT INTO sync_log (operacao, chave, detalhes, status, ip_origem, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [operacao, chave, detalhes, status, ip || 'desconhecido', userAgent || 'desconhecido']
        );
    } catch (error) {
        console.error('❌ Erro ao registrar log:', error);
    }
}

// ============================================================
// HANDLER
// ============================================================
exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ sucesso: false, erro: "Método não permitido. Use POST." })
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

    const ipOrigem = event.headers['x-forwarded-for'] || 'desconhecido';
    const userAgent = event.headers['user-agent'] || 'desconhecido';

    try {
        const body = JSON.parse(event.body);
        const { dados, chave = 'dados_principais' } = body;

        if (!dados) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Campo 'dados' é obrigatório" })
            };
        }

        if (!dados.users || !dados.products || !dados.clients || !dados.sales) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Estrutura de dados inválida" })
            };
        }

        const versaoAtual = body.versao || 0;
        const novaVersao = versaoAtual + 1;

        const queryUpsert = `
            INSERT INTO dados_utilizador (chave, conteudo, versao, atualizado_em)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (chave) 
            DO UPDATE SET 
                conteudo = EXCLUDED.conteudo,
                versao = EXCLUDED.versao,
                atualizado_em = CURRENT_TIMESTAMP
            RETURNING id, versao, atualizado_em
        `;

        const resultado = await pool.query(queryUpsert, [chave, dados, novaVersao]);

        await registrarLog('sincronizacao', chave, { versao: novaVersao }, 'Sucesso', ipOrigem, userAgent);

        return {
            statusCode: 200,
            body: JSON.stringify({
                sucesso: true,
                chave: chave,
                versao: novaVersao,
                atualizado_em: resultado.rows[0].atualizado_em,
                mensagem: "Sincronização concluída!"
            })
        };

    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: "Erro na sincronização"
            })
        };
    }
};