// netlify/functions/notificacao.js
// Sistema de notificações push

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
            ['notificacao_' + operacao, 'notificacao', detalhes, status, ip || 'desconhecido', userAgent || 'desconhecido']
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
            case 'enviar': {
                // Enviar notificação push
                const { titulo, mensagem, destino, tipo } = dados;

                if (!titulo || !mensagem) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: "Título e mensagem são obrigatórios"
                        })
                    };
                }

                // Salvar notificação no banco
                const query = `
                    INSERT INTO notificacoes (titulo, mensagem, tipo, destino, enviado_em, status)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
                    RETURNING id
                `;
                const resultado = await pool.query(query, [
                    titulo,
                    mensagem,
                    tipo || 'info',
                    destino || 'todos',
                    'Enviado'
                ]);

                await registrarLog('enviar', {
                    titulo: titulo,
                    destino: destino || 'todos',
                    id: resultado.rows[0].id
                }, 'Sucesso', ipOrigem, userAgent);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        id: resultado.rows[0].id,
                        mensagem: 'Notificação enviada com sucesso!'
                    })
                };
            }

            case 'listar': {
                // Listar notificações
                const query = `
                    SELECT id, titulo, mensagem, tipo, destino, enviado_em, status
                    FROM notificacoes 
                    ORDER BY enviado_em DESC 
                    LIMIT 50
                `;
                const resultado = await pool.query(query);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        notificacoes: resultado.rows
                    })
                };
            }

            case 'verificar': {
                // Verificar notificações pendentes
                // Contas vencendo hoje
                const hoje = new Date().toISOString().slice(0, 10);
                const queryContas = `
                    SELECT id, descricao, valor, tipo, data_vencimento
                    FROM contas
                    WHERE data_vencimento = $1 AND status = 'Pendente'
                `;
                const contasVencendo = await pool.query(queryContas, [hoje]);

                // Estoque baixo
                const queryEstoque = `
                    SELECT id, nome, codigo, stock, min_stock
                    FROM products
                    WHERE stock <= min_stock
                `;
                const estoqueBaixo = await pool.query(queryEstoque);

                const notificacoes = {
                    contas_vencendo: contasVencendo.rows,
                    estoque_baixo: estoqueBaixo.rows,
                    total: contasVencendo.rows.length + estoqueBaixo.rows.length
                };

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        notificacoes_pendentes: notificacoes
                    })
                };
            }

            case 'marcar_lida': {
                // Marcar notificação como lida
                const { id } = dados;

                if (!id) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: "ID da notificação é obrigatório"
                        })
                    };
                }

                await pool.query(
                    `UPDATE notificacoes SET status = 'Lida' WHERE id = $1`,
                    [id]
                );

                await registrarLog('marcar_lida', { id: id }, 'Sucesso', ipOrigem, userAgent);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        sucesso: true,
                        mensagem: 'Notificação marcada como lida'
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
        console.error('❌ Erro na notificação:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: "Erro interno"
            })
        };
    }
};