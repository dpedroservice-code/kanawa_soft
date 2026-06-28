// netlify/functions/email.js
// Envio de emails

const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@kanawasoft.com';

if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

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
// TEMPLATES DE EMAIL
// ============================================================
function templateBemVindo(nome) {
    return `
        <h1>Bem-vindo ao KanawaSoft ERP!</h1>
        <p>Olá ${nome},</p>
        <p>Sua conta foi criada com sucesso no KanawaSoft ERP.</p>
        <p>Você já pode começar a usar todas as funcionalidades do sistema.</p>
        <p>
            <a href="https://kanawasoft.shop" style="padding:10px 20px;background:#1a3a5c;color:#fff;text-decoration:none;border-radius:8px;">
                Acessar Sistema
            </a>
        </p>
        <p>Equipe KanawaSoft</p>
    `;
}

function templateRecuperacaoSenha(nome, novaSenha) {
    return `
        <h1>Recuperação de Senha</h1>
        <p>Olá ${nome},</p>
        <p>Conforme solicitado, sua senha foi redefinida.</p>
        <p><strong>Nova senha temporária:</strong> ${novaSenha}</p>
        <p>Recomendamos que você altere esta senha após o primeiro login.</p>
        <p>
            <a href="https://kanawasoft.shop" style="padding:10px 20px;background:#1a3a5c;color:#fff;text-decoration:none;border-radius:8px;">
                Acessar Sistema
            </a>
        </p>
        <p>Equipe KanawaSoft</p>
    `;
}

function templateRelatorio(nome, dados) {
    return `
        <h1>Relatório Gerencial</h1>
        <p>Olá ${nome},</p>
        <p>Aqui está o relatório solicitado:</p>
        <pre style="background:#f5f5f5;padding:15px;border-radius:8px;">
        ${JSON.stringify(dados, null, 2)}
        </pre>
        <p>
            <a href="https://kanawasoft.shop" style="padding:10px 20px;background:#1a3a5c;color:#fff;text-decoration:none;border-radius:8px;">
                Ver no Sistema
            </a>
        </p>
        <p>Equipe KanawaSoft</p>
    `;
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
        const { to, assunto, template, dados, token: userToken } = body;

        // Verificar se é admin ou se é uma requisição pública (ex: recuperação de senha)
        let isAdmin = false;
        if (userToken) {
            isAdmin = verificarAdmin(userToken);
        }

        // Para templates públicos, não precisa de admin
        const templatesPublicos = ['recuperacao_senha'];
        const isPublic = templatesPublicos.includes(template);

        if (!isAdmin && !isPublic) {
            return {
                statusCode: 401,
                body: JSON.stringify({ 
                    sucesso: false, 
                    erro: "Não autorizado" 
                })
            };
        }

        if (!to || !assunto || !template) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    sucesso: false,
                    erro: "Campos obrigatórios: to, assunto, template"
                })
            };
        }

        // Gerar HTML do email
        let html = '';
        switch (template) {
            case 'bem_vindo':
                html = templateBemVindo(dados?.nome || 'Usuário');
                break;
            case 'recuperacao_senha':
                html = templateRecuperacaoSenha(
                    dados?.nome || 'Usuário',
                    dados?.nova_senha || 'senha_temporaria'
                );
                break;
            case 'relatorio':
                html = templateRelatorio(dados?.nome || 'Usuário', dados?.relatorio || {});
                break;
            default:
                html = `<h1>${assunto}</h1><p>${JSON.stringify(dados)}</p>`;
        }

        // Enviar email
        if (SENDGRID_API_KEY) {
            const msg = {
                to: to,
                from: FROM_EMAIL,
                subject: assunto,
                html: html
            };

            await sgMail.send(msg);
        } else {
            // Fallback: apenas log
            console.log(`📧 [EMAIL] Para: ${to}`);
            console.log(`📧 [EMAIL] Assunto: ${assunto}`);
            console.log(`📧 [EMAIL] HTML: ${html}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                sucesso: true,
                mensagem: `Email enviado para ${to}`,
                enviado_com: SENDGRID_API_KEY ? 'SendGrid' : 'Log (fallback)'
            })
        };

    } catch (error) {
        console.error('❌ Erro no envio de email:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                sucesso: false,
                erro: error.message
            })
        };
    }
};