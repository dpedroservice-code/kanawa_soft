// netlify/functions/admin.js
// KanawaSoft ERP - Admin Functions v3.0 (PostgreSQL Only)
// Operações administrativas completas

const { Pool } = require('pg');

// ============================================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ============================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
        rejectUnauthorized: false,
        sslmode: 'require'
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// ============================================================
// UTILITÁRIOS
// ============================================================

function verificarAdmin(token) {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || !token) return false;
    return token === adminToken;
}

async function query(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return result;
    } catch (error) {
        console.error('❌ Erro na query:', error);
        throw error;
    }
}

async function getTableStats() {
    const tables = [
        'usuarios', 'empresa', 'clientes', 'produtos', 'vendas',
        'orcamentos', 'contas', 'movimentacoes', 'transferencias',
        'categorias', 'notas_fiscais', 'devolucoes', 'logs',
        'fornecedores', 'pedidos_compra', 'funcionarios', 'pontos',
        'projetos', 'atendimentos', 'transportadoras', 'entregas',
        'marketing', 'filiais', 'webhooks', 'configuracoes'
    ];
    
    const stats = {};
    for (const table of tables) {
        try {
            const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = parseInt(result.rows[0].count);
        } catch {
            stats[table] = 0;
        }
    }
    return stats;
}

// ============================================================
// FUNÇÕES DE BACKUP
// ============================================================

async function createFullBackup() {
    const tables = [
        'usuarios', 'empresa', 'clientes', 'produtos', 'vendas',
        'orcamentos', 'contas', 'movimentacoes', 'transferencias',
        'categorias', 'notas_fiscais', 'devolucoes', 'logs',
        'fornecedores', 'pedidos_compra', 'funcionarios', 'pontos',
        'projetos', 'atendimentos', 'transportadoras', 'entregas',
        'marketing', 'filiais', 'webhooks', 'configuracoes'
    ];
    
    const backup = {};
    let totalRecords = 0;
    
    for (const table of tables) {
        try {
            const result = await query(`SELECT * FROM ${table}`);
            backup[table] = result.rows;
            totalRecords += result.rows.length;
        } catch (error) {
            console.warn(`⚠️ Tabela ${table} não encontrada:`, error.message);
            backup[table] = [];
        }
    }
    
    return {
        backup,
        totalRecords,
        timestamp: new Date().toISOString(),
        version: '3.0.0'
    };
}

async function restoreBackup(backupData, confirm) {
    if (!confirm || confirm !== 'CONFIRMAR_RESTAURACAO') {
        throw new Error('Confirmação necessária para restaurar backup');
    }
    
    const tables = Object.keys(backupData);
    const results = [];
    
    for (const table of tables) {
        try {
            // Limpar tabela
            await query(`DELETE FROM ${table}`);
            
            // Inserir dados
            if (backupData[table] && backupData[table].length > 0) {
                for (const row of backupData[table]) {
                    const keys = Object.keys(row);
                    const values = Object.values(row);
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    const columns = keys.join(', ');
                    
                    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
                    await query(sql, values);
                }
            }
            
            results.push({ 
                table, 
                count: backupData[table]?.length || 0,
                status: 'success'
            });
        } catch (error) {
            results.push({ 
                table, 
                status: 'error',
                error: error.message
            });
        }
    }
    
    return results;
}

// ============================================================
// FUNÇÕES DE EXPORTAÇÃO/IMPORTAÇÃO
// ============================================================

async function exportData(collection, filters = {}) {
    let sql = `SELECT * FROM ${collection}`;
    const params = [];
    const conditions = [];
    
    if (Object.keys(filters).length > 0) {
        Object.entries(filters).forEach(([key, value], index) => {
            conditions.push(`${key} = $${index + 1}`);
            params.push(value);
        });
        sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const result = await query(sql, params);
    return result.rows;
}

async function importData(collection, data, overwrite = false) {
    const results = [];
    
    for (const row of data) {
        try {
            // Verificar se já existe
            if (row.id) {
                const check = await query(
                    `SELECT id FROM ${collection} WHERE id = $1`,
                    [row.id]
                );
                
                if (check.rows.length > 0 && overwrite) {
                    // Atualizar
                    const keys = Object.keys(row);
                    const values = Object.values(row);
                    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
                    
                    await query(
                        `UPDATE ${collection} SET ${setClause} WHERE id = $${keys.length + 1}`,
                        [...values, row.id]
                    );
                    results.push({ id: row.id, status: 'updated' });
                } else if (check.rows.length === 0) {
                    // Inserir
                    await insertRecord(collection, row);
                    results.push({ id: row.id, status: 'inserted' });
                } else {
                    results.push({ id: row.id, status: 'skipped' });
                }
            } else {
                // Inserir sem ID
                await insertRecord(collection, row);
                results.push({ status: 'inserted' });
            }
        } catch (error) {
            results.push({ 
                data: row, 
                status: 'error',
                error: error.message 
            });
        }
    }
    
    return results;
}

async function insertRecord(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');
    
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING id`;
    const result = await query(sql, values);
    return result.rows[0];
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

exports.handler = async (event) => {
    // CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Verificar método
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                sucesso: false, 
                erro: 'Método não permitido' 
            })
        };
    }

    // Autenticação
    const authHeader = event.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!verificarAdmin(token)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ 
                sucesso: false, 
                erro: 'Não autorizado - Token inválido ou expirado' 
            })
        };
    }

    try {
        // Parse do body
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const { acao, dados } = body;
        const { query } = event.queryStringParameters || {};

        let resultado;

        switch (acao || query) {
            // ============================================================
            // STATS - Estatísticas do sistema
            // ============================================================
            case 'stats': {
                const stats = await getTableStats();
                
                // Calcular total de vendas
                try {
                    const salesResult = await query('SELECT SUM(total) as total FROM vendas');
                    stats.total_vendas_valor = parseFloat(salesResult.rows[0]?.total || 0);
                } catch {
                    stats.total_vendas_valor = 0;
                }

                // Calcular saldo financeiro
                try {
                    const contasResult = await query(`
                        SELECT 
                            SUM(CASE WHEN tipo = 'receber' AND status = 'Pago' THEN valor ELSE 0 END) as recebido,
                            SUM(CASE WHEN tipo = 'pagar' AND status = 'Pago' THEN valor ELSE 0 END) as pago
                        FROM contas
                    `);
                    const row = contasResult.rows[0];
                    stats.saldo_financeiro = (row?.recebido || 0) - (row?.pago || 0);
                } catch {
                    stats.saldo_financeiro = 0;
                }

                // Calcular estoque total
                try {
                    const estoqueResult = await query('SELECT SUM(estoque) as total FROM produtos');
                    stats.total_estoque = parseInt(estoqueResult.rows[0]?.total || 0);
                } catch {
                    stats.total_estoque = 0;
                }

                resultado = { sucesso: true, stats };
                break;
            }

            // ============================================================
            // BACKUP - Criar backup completo
            // ============================================================
            case 'backup': {
                const backupData = await createFullBackup();
                
                // Salvar backup no banco
                try {
                    await query(`
                        INSERT INTO backups (dados, total_registros, data)
                        VALUES ($1, $2, $3)
                    `, [
                        JSON.stringify(backupData.backup),
                        backupData.totalRecords,
                        new Date().toISOString()
                    ]);
                } catch (error) {
                    console.warn('⚠️ Não foi possível salvar backup no banco:', error.message);
                }

                resultado = { 
                    sucesso: true, 
                    backup: backupData,
                    mensagem: `Backup criado com ${backupData.totalRecords} registros`
                };
                break;
            }

            // ============================================================
            // RESTORE - Restaurar backup
            // ============================================================
            case 'restore': {
                const { backup, confirmar } = dados || {};
                
                if (!backup) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Dados de backup não fornecidos'
                        })
                    };
                }

                const results = await restoreBackup(backup, confirmar);
                
                // Registrar log
                await query(`
                    INSERT INTO logs (usuario_nome, acao, detalhes, data)
                    VALUES ($1, $2, $3, $4)
                `, [
                    'admin',
                    'restore_backup',
                    JSON.stringify(results),
                    new Date().toISOString()
                ]);

                resultado = { 
                    sucesso: true, 
                    mensagem: 'Backup restaurado com sucesso',
                    detalhes: results
                };
                break;
            }

            // ============================================================
            // EXPORT - Exportar dados
            // ============================================================
            case 'export': {
                const { colecao, filtros } = dados || {};
                
                if (!colecao) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Coleção não especificada'
                        })
                    };
                }

                const data = await exportData(colecao, filtros || {});
                resultado = { 
                    sucesso: true, 
                    dados: data,
                    total: data.length,
                    colecao
                };
                break;
            }

            // ============================================================
            // IMPORT - Importar dados
            // ============================================================
            case 'import': {
                const { colecao, dados: importData, sobrescrever } = dados || {};
                
                if (!colecao || !importData || !Array.isArray(importData)) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Dados inválidos para importação'
                        })
                    };
                }

                const results = await importData(colecao, importData, sobrescrever || false);
                
                // Registrar log
                await query(`
                    INSERT INTO logs (usuario_nome, acao, detalhes, data)
                    VALUES ($1, $2, $3, $4)
                `, [
                    'admin',
                    'import_data',
                    JSON.stringify({ colecao, total: results.length }),
                    new Date().toISOString()
                ]);

                resultado = { 
                    sucesso: true, 
                    mensagem: `${results.length} registros processados`,
                    resultados: results
                };
                break;
            }

            // ============================================================
            // RESET - Resetar banco de dados
            // ============================================================
            case 'reset': {
                if (!dados?.confirmar || dados.confirmar !== 'RESETAR_TUDO') {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Confirmação necessária. Use confirmar: "RESETAR_TUDO"'
                        })
                    };
                }

                // Fazer backup antes de resetar
                const backupData = await createFullBackup();
                
                // Deletar dados
                const tables = [
                    'logs', 'movimentacoes', 'contas', 'orcamentos',
                    'notas_fiscais', 'devolucoes', 'transferencias',
                    'vendas', 'clientes', 'produtos', 'categorias',
                    'usuarios'
                ];
                
                for (const table of tables) {
                    try {
                        await query(`DELETE FROM ${table}`);
                    } catch (error) {
                        console.warn(`⚠️ Não foi possível limpar ${table}:`, error.message);
                    }
                }

                // Registrar log
                await query(`
                    INSERT INTO logs (usuario_nome, acao, detalhes, data)
                    VALUES ($1, $2, $3, $4)
                `, [
                    'admin',
                    'reset_database',
                    JSON.stringify({ backup: backupData.totalRecords }),
                    new Date().toISOString()
                ]);

                resultado = {
                    sucesso: true,
                    mensagem: 'Banco de dados resetado com sucesso!',
                    backup_antigo: backupData
                };
                break;
            }

            // ============================================================
            // LOGS - Listar logs de auditoria
            // ============================================================
            case 'logs': {
                const limite = dados?.limite || 100;
                const queryLogs = `
                    SELECT id, usuario_nome, acao, detalhes, data, ip
                    FROM logs 
                    ORDER BY data DESC 
                    LIMIT $1
                `;
                const result = await query(queryLogs, [limite]);
                resultado = { 
                    sucesso: true, 
                    logs: result.rows,
                    total: result.rows.length
                };
                break;
            }

            // ============================================================
            // LOGS_CLEAR - Limpar logs
            // ============================================================
            case 'logs_clear': {
                if (!dados?.confirmar || dados.confirmar !== 'LIMPAR_LOGS') {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Confirmação necessária. Use confirmar: "LIMPAR_LOGS"'
                        })
                    };
                }
                await query('DELETE FROM logs');
                resultado = { 
                    sucesso: true, 
                    mensagem: 'Logs limpos com sucesso!' 
                };
                break;
            }

            // ============================================================
            // SYSTEM_INFO - Informações do sistema
            // ============================================================
            case 'system_info': {
                const dbInfo = await query('SELECT version() as version');
                const uptime = process.uptime();
                const memory = process.memoryUsage();
                
                resultado = {
                    sucesso: true,
                    sistema: {
                        database: dbInfo.rows[0].version,
                        uptime: uptime,
                        uptime_formatado: formatarUptime(uptime),
                        memoria: {
                            rss: formatarBytes(memory.rss),
                            heap_total: formatarBytes(memory.heapTotal),
                            heap_usado: formatarBytes(memory.heapUsed)
                        },
                        node_version: process.version,
                        ambiente: process.env.NODE_ENV || 'production',
                        timestamp: new Date().toISOString()
                    }
                };
                break;
            }

            // ============================================================
            // USERS - Listar usuários
            // ============================================================
            case 'users': {
                const users = await query(`
                    SELECT id, nome, email, perfil, status, criado_em, ultimo_login
                    FROM usuarios
                    ORDER BY nome
                `);
                resultado = { 
                    sucesso: true, 
                    usuarios: users.rows,
                    total: users.rows.length
                };
                break;
            }

            // ============================================================
            // USER_CREATE - Criar usuário
            // ============================================================
            case 'user_create': {
                const { nome, email, senha, perfil } = dados || {};
                
                if (!nome || !email || !senha) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Nome, email e senha são obrigatórios'
                        })
                    };
                }

                // Verificar se email já existe
                const check = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
                if (check.rows.length > 0) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Email já cadastrado'
                        })
                    };
                }

                const hashedPassword = await bcrypt.hash(senha, 10);
                const result = await query(`
                    INSERT INTO usuarios (nome, email, senha_hash, perfil, status, criado_em)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id, nome, email, perfil, status, criado_em
                `, [
                    nome, 
                    email, 
                    hashedPassword, 
                    perfil || 'vendedor', 
                    'Ativo',
                    new Date().toISOString()
                ]);

                resultado = { 
                    sucesso: true, 
                    usuario: result.rows[0],
                    mensagem: 'Usuário criado com sucesso!'
                };
                break;
            }

            // ============================================================
            // USER_UPDATE - Atualizar usuário
            // ============================================================
            case 'user_update': {
                const { id, nome, email, perfil, status, senha } = dados || {};
                
                if (!id) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'ID do usuário é obrigatório'
                        })
                    };
                }

                let sql = `
                    UPDATE usuarios 
                    SET nome = $1, email = $2, perfil = $3, status = $4, atualizado_em = $5
                `;
                const params = [nome, email, perfil, status, new Date().toISOString()];

                if (senha) {
                    const hashedPassword = await bcrypt.hash(senha, 10);
                    sql += `, senha_hash = $6`;
                    params.push(hashedPassword);
                }

                sql += ` WHERE id = $${params.length + 1} RETURNING id, nome, email, perfil, status, criado_em, atualizado_em`;
                params.push(id);

                const result = await query(sql, params);
                
                if (result.rows.length === 0) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Usuário não encontrado'
                        })
                    };
                }

                resultado = { 
                    sucesso: true, 
                    usuario: result.rows[0],
                    mensagem: 'Usuário atualizado com sucesso!'
                };
                break;
            }

            // ============================================================
            // USER_DELETE - Deletar usuário
            // ============================================================
            case 'user_delete': {
                const { id } = dados || {};
                
                if (!id) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'ID do usuário é obrigatório'
                        })
                    };
                }

                // Verificar se é o último admin
                const adminCount = await query(`
                    SELECT COUNT(*) as total FROM usuarios WHERE perfil = 'admin'
                `);
                
                const user = await query('SELECT perfil FROM usuarios WHERE id = $1', [id]);
                if (user.rows.length > 0 && user.rows[0].perfil === 'admin' && parseInt(adminCount.rows[0].total) <= 1) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Não é possível deletar o único administrador do sistema'
                        })
                    };
                }

                const result = await query('DELETE FROM usuarios WHERE id = $1 RETURNING id, nome, email', [id]);
                
                if (result.rows.length === 0) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({
                            sucesso: false,
                            erro: 'Usuário não encontrado'
                        })
                    };
                }

                resultado = { 
                    sucesso: true, 
                    usuario: result.rows[0],
                    mensagem: 'Usuário deletado com sucesso!'
                };
                break;
            }

            // ============================================================
            // DEFAULT
            // ============================================================
            default: {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        sucesso: false,
                        erro: `Ação '${acao || query}' não suportada`,
                        acoes_disponiveis: [
                            'stats', 'backup', 'restore', 'export', 'import',
                            'reset', 'logs', 'logs_clear', 'system_info',
                            'users', 'user_create', 'user_update', 'user_delete'
                        ]
                    })
                };
            }
        }

        // Registrar ação no log (exceto para leituras)
        if (!['stats', 'logs', 'system_info', 'users'].includes(acao || query)) {
            try {
                await query(`
                    INSERT INTO logs (usuario_nome, acao, detalhes, data, ip)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    'admin',
                    `admin_${acao || query}`,
                    JSON.stringify(dados || {}),
                    new Date().toISOString(),
                    event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown'
                ]);
            } catch (error) {
                console.warn('⚠️ Não foi possível registrar log:', error.message);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(resultado)
        };

    } catch (error) {
        console.error('❌ Erro na função admin:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sucesso: false,
                erro: error.message || 'Erro interno do servidor',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};

// ============================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================

function formatarUptime(segundos) {
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);
    
    if (dias > 0) return `${dias}d ${horas}h ${minutos}m ${segs}s`;
    if (horas > 0) return `${horas}h ${minutos}m ${segs}s`;
    if (minutos > 0) return `${minutos}m ${segs}s`;
    return `${segs}s`;
}

function formatarBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
// EXPORTAÇÃO PARA TESTES
// ============================================================

module.exports = {
    handler: exports.handler,
    query,
    createFullBackup,
    restoreBackup,
    exportData,
    importData,
    getTableStats,
    verificarAdmin
};