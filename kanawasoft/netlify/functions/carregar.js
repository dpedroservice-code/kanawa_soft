// netlify/functions/carregar.js
// Carrega dados do PostgreSQL da Aiven

const { Pool } = require('pg');

// ============================================================
// CONEXÃO COM AIVEN
// ============================================================
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
// CRIAÇÃO AUTOMÁTICA DE TABELAS
// ============================================================
async function criarTabelas() {
    const sql = `
        -- USUÁRIOS
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            senha_hash VARCHAR(255) NOT NULL,
            telefone VARCHAR(20),
            perfil VARCHAR(30) DEFAULT 'vendedor',
            status VARCHAR(20) DEFAULT 'Ativo',
            ultimo_login TIMESTAMP,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- EMPRESA
        CREATE TABLE IF NOT EXISTS empresa (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(200) NOT NULL,
            nif VARCHAR(30),
            email VARCHAR(150),
            telefone VARCHAR(20),
            endereco TEXT,
            moeda VARCHAR(10) DEFAULT 'AOA',
            logo VARCHAR(255),
            garantia TEXT,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- CATEGORIAS
        CREATE TABLE IF NOT EXISTS categorias (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            descricao TEXT,
            icone VARCHAR(50),
            cor VARCHAR(7) DEFAULT '#1a3a5c',
            pai_id INTEGER REFERENCES categorias(id),
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- PRODUTOS
        CREATE TABLE IF NOT EXISTS produtos (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(200) NOT NULL,
            codigo VARCHAR(50) UNIQUE NOT NULL,
            preco DECIMAL(15,2) DEFAULT 0,
            custo DECIMAL(15,2) DEFAULT 0,
            estoque INTEGER DEFAULT 0,
            estoque_minimo INTEGER DEFAULT 5,
            categoria_id INTEGER REFERENCES categorias(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- CLIENTES
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(200) NOT NULL,
            nif VARCHAR(30),
            telefone VARCHAR(20),
            email VARCHAR(150),
            endereco TEXT,
            total_compras DECIMAL(15,2) DEFAULT 0,
            total_pedidos INTEGER DEFAULT 0,
            ultima_compra DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- VENDAS
        CREATE TABLE IF NOT EXISTS vendas (
            id SERIAL PRIMARY KEY,
            invoice VARCHAR(50) UNIQUE NOT NULL,
            cliente_id INTEGER REFERENCES clientes(id),
            cliente_nome VARCHAR(200) NOT NULL,
            cliente_nif VARCHAR(30),
            cliente_telefone VARCHAR(20),
            total DECIMAL(15,2) NOT NULL,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            items JSONB NOT NULL,
            forma_pagamento VARCHAR(50),
            vendedor_id INTEGER REFERENCES usuarios(id),
            vendedor_nome VARCHAR(100),
            status VARCHAR(30) DEFAULT 'Concluída'
        );

        -- ORÇAMENTOS
        CREATE TABLE IF NOT EXISTS orcamentos (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(50) UNIQUE NOT NULL,
            cliente VARCHAR(200) NOT NULL,
            descricao TEXT,
            valor DECIMAL(15,2) NOT NULL,
            status VARCHAR(30) DEFAULT 'Pendente',
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- CONTAS (Financeiro)
        CREATE TABLE IF NOT EXISTS contas (
            id SERIAL PRIMARY KEY,
            tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receber', 'pagar')),
            descricao VARCHAR(200) NOT NULL,
            valor DECIMAL(15,2) NOT NULL,
            data_vencimento DATE NOT NULL,
            status VARCHAR(30) DEFAULT 'Pendente',
            categoria VARCHAR(50),
            cliente_fornecedor VARCHAR(200),
            data_pagamento DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- MOVIMENTAÇÕES DE ESTOQUE
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id SERIAL PRIMARY KEY,
            produto_id INTEGER REFERENCES produtos(id),
            produto_nome VARCHAR(200) NOT NULL,
            tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia', 'devolucao')),
            quantidade INTEGER NOT NULL,
            estoque_anterior INTEGER NOT NULL,
            estoque_atual INTEGER NOT NULL,
            motivo VARCHAR(200),
            usuario VARCHAR(100),
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- TRANSFERÊNCIAS
        CREATE TABLE IF NOT EXISTS transferencias (
            id SERIAL PRIMARY KEY,
            produto_id INTEGER REFERENCES produtos(id),
            produto_nome VARCHAR(200) NOT NULL,
            quantidade INTEGER NOT NULL,
            origem VARCHAR(100) NOT NULL,
            destino VARCHAR(100) NOT NULL,
            data_transferencia TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            usuario VARCHAR(100),
            status VARCHAR(30) DEFAULT 'Concluída'
        );

        -- DEVOLUÇÕES
        CREATE TABLE IF NOT EXISTS devolucoes (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(50) UNIQUE NOT NULL,
            venda_id INTEGER REFERENCES vendas(id),
            cliente_nome VARCHAR(200) NOT NULL,
            valor DECIMAL(15,2) NOT NULL,
            motivo TEXT,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(30) DEFAULT 'Pendente',
            usuario VARCHAR(100)
        );

        -- NOTAS FISCAIS
        CREATE TABLE IF NOT EXISTS notas_fiscais (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(50) UNIQUE NOT NULL,
            venda_id INTEGER REFERENCES vendas(id),
            cliente_nome VARCHAR(200) NOT NULL,
            cliente_nif VARCHAR(30),
            total DECIMAL(15,2) NOT NULL,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(30) DEFAULT 'Emitida'
        );

        -- LOGS DE AUDITORIA
        CREATE TABLE IF NOT EXISTS logs_auditoria (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER REFERENCES usuarios(id),
            usuario_nome VARCHAR(100),
            acao VARCHAR(100) NOT NULL,
            detalhes JSONB,
            ip VARCHAR(45),
            user_agent TEXT,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- ÍNDICES
        CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
        CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
        CREATE INDEX IF NOT EXISTS idx_vendas_invoice ON vendas(invoice);
        CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas(data_vencimento);
        CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes(produto_id);
        CREATE INDEX IF NOT EXISTS idx_categorias_pai ON categorias(pai_id);

        -- USUÁRIO ADMIN PADRÃO
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        SELECT 'Administrador', 'admin@kanawasoft.com', 
               crypt('admin123', gen_salt('bf')), 'admin'
        WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@kanawasoft.com');

        -- EMPRESA PADRÃO
        INSERT INTO empresa (nome, moeda, garantia)
        SELECT 'KanawaSoft ERP', 'AOA', 'Garantia de 30 dias contra defeitos de fabricação.'
        WHERE NOT EXISTS (SELECT 1 FROM empresa LIMIT 1);

        -- CATEGORIAS PADRÃO
        INSERT INTO categorias (nome, icone, cor)
        SELECT 'Alimentos', 'fa-apple-alt', '#10b981'
        WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'Alimentos');

        INSERT INTO categorias (nome, icone, cor)
        SELECT 'Bebidas', 'fa-wine-bottle', '#f59e0b'
        WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'Bebidas');

        INSERT INTO categorias (nome, icone, cor)
        SELECT 'Higiene', 'fa-soap', '#3b82f6'
        WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'Higiene');

        INSERT INTO categorias (nome, icone, cor)
        SELECT 'Limpeza', 'fa-hand-sparkles', '#8b5cf6'
        WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'Limpeza');

        INSERT INTO categorias (nome, icone, cor)
        SELECT 'Eletrônicos', 'fa-microchip', '#ef4444'
        WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nome = 'Eletrônicos');
    `;

    try {
        await pool.query(sql);
        console.log('✅ Tabelas criadas/verificadas com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error.message);
        throw error;
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
exports.handler = async (event) => {
    if (event.httpMethod !== "GET") {
        return {
            statusCode: 405,
            body: JSON.stringify({ sucesso: false, erro: "Método não permitido. Use GET." })
        };
    }

    try {
        await criarTabelas();

        const { tabela, id, limite = 100 } = event.queryStringParameters || {};

        if (!tabela) {
            return {
                statusCode: 400,
                body: JSON.stringify({ sucesso: false, erro: "Parâmetro 'tabela' é obrigatório" })
            };
        }

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

        let query = `SELECT * FROM ${tabelaNome}`;
        let params = [];

        if (id) {
            query += ` WHERE id = $1`;
            params.push(id);
        }

        query += ` ORDER BY id DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limite));

        const resultado = await pool.query(query, params);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                sucesso: true,
                dados: resultado.rows,
                total: resultado.rows.length
            })
        };

    } catch (error) {
        console.error('❌ Erro no carregar.js:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: error.message || "Erro interno do servidor"
            })
        };
    }
};