// netlify/functions/upload.js
// Upload de arquivos e imagens

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Inicializar Supabase (apenas para storage)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

// ============================================================
// VALIDAÇÃO
// ============================================================
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validarArquivo(file) {
    if (!file) return { valido: false, erro: 'Arquivo não fornecido' };
    
    if (file.size > MAX_FILE_SIZE) {
        return { valido: false, erro: `Arquivo excede ${MAX_FILE_SIZE/1024/1024}MB` };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valido: false, erro: 'Tipo de arquivo não permitido' };
    }

    return { valido: true };
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

    try {
        const body = JSON.parse(event.body);
        const { file, nome, pasta = 'uploads' } = body;

        // Validar arquivo
        const validacao = validarArquivo({ 
            size: file?.length || 0, 
            type: body.tipo || 'image/png' 
        });

        if (!validacao.valido) {
            return {
                statusCode: 400,
                body: JSON.stringify({ erro: validacao.erro })
            };
        }

        // Gerar nome único
        const ext = body.tipo?.split('/')[1] || 'png';
        const nomeArquivo = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
        const caminho = `${pasta}/${nomeArquivo}`;

        // Decodificar base64
        const buffer = Buffer.from(file, 'base64');

        // Salvar no Supabase Storage
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(caminho, buffer, {
                contentType: body.tipo || 'image/png',
                cacheControl: '3600'
            });

        if (error) throw error;

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from('uploads')
            .getPublicUrl(caminho);

        return {
            statusCode: 200,
            body: JSON.stringify({
                sucesso: true,
                url: urlData.publicUrl,
                nome: nomeArquivo,
                caminho: caminho,
                tamanho: buffer.length
            })
        };

    } catch (error) {
        console.error('❌ Erro no upload:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: error.message
            })
        };
    }
};