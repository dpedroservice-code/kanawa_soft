// netlify/functions/backup.js
// Backup e restauração de dados

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
// FUNÇÃO DE LOG
// ============================================================
async function registrarLog(operacao, detalhes, status, ip, userAgent) {
    try {
        await pool.query(
            `INSERT INTO sync_log (operacao, chave, detalhes, status, ip_origem, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            ['backup_' + operacao, 'backup', detalhes, status, ip || 'desconhecido', userAgent || 'desconhecido']
        );
    } catch (error) {
        console.error('❌ Erro ao registrar log:', error);
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

    const ipOrigem = event.headers['x-forwarded-for'] || 'desconhecido';
    const userAgent = event.headers['user-agent'] || 'desconhecido';

    try {
        const body = JSON.parse(event.body);
        const { acao, dados } = body;

        switch (acao) {
            case 'criar': {
                // Criar backup completo
                const query = `
                    SELECT chave, conteudo, versao, atualizado_em 
                    FROM dados_utilizador 
                    ORDER BY chave
                `;
                const resultado = await pool.query(query);

                const backup = {
                    timestamp: new Date().toISOString(),
                    versao: '2.0',
                    total_registros: resultado.rows.length,
                    dados: resultado.rows
                };

                await registrarLog('criar', { 
                    total: resultado.rows.length 
                }, 'Sucesso', ipOrigem, userAgent);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        backup: backup
                    })
                };
            }

            case 'restaurar': {
                // Restaurar backup
                const { backup } = dados;

                if (!backup || !backup.dados) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: "Dados do backup inválidos"
                        })
                    };
                }

                // Validar backup
                if (!backup.dados || !Array.isArray(backup.dados)) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: "Estrutura do backup inválida"
                        })
                    };
                }

                // Limpar tabela
                await pool.query('DELETE FROM dados_utilizador');

                // Restaurar dados
                let restaurados = 0;
                for (const item of backup.dados) {
                    const query = `
                        INSERT INTO dados_utilizador (chave, conteudo, versao, criado_em, atualizado_em)
                        VALUES ($1, $2, $3, $4, $5)
                    `;
                    await pool.query(query, [
                        item.chave,
                        item.conteudo,
                        item.versao || 1,
                        item.criado_em || new Date().toISOString(),
                        item.atualizado_em || new Date().toISOString()
                    ]);
                    restaurados++;
                }

                await registrarLog('restaurar', {
                    restaurados: restaurados
                }, 'Sucesso', ipOrigem, userAgent);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        mensagem: `Backup restaurado com sucesso! ${restaurados} registros.`
                    })
                };
            }

            case 'listar': {
                // Listar backups disponíveis
                const query = `
                    SELECT operacao, detalhes, sincronizado_em, ip_origem
                    FROM sync_log 
                    WHERE operacao LIKE 'backup_%' 
                    ORDER BY sincronizado_em DESC 
                    LIMIT 20
                `;
                const resultado = await pool.query(query);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        backups: resultado.rows
                    })
                };
            }

            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        sucesso: false,
                        erro: "Ação não suportada"
                    })
                };
        }

    } catch (error) {
        console.error('❌ Erro no backup:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: "Erro interno"
            })
        };
    }
};