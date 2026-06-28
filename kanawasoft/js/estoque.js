// ============================================================
// KANAWASOFT ERP - ESTOQUE.JS
// ============================================================
// Versão 3.0.0 - Gestão de Estoque
// ============================================================

const ESTOQUE = {
    // ============================================================
    // PRODUTOS
    // ============================================================
    getProdutos() {
        return db.getAll('produtos');
    },

    getProduto(id) {
        return db.get('produtos', id);
    },

    getProdutoByCodigo(codigo) {
        return db.getAll('produtos').find(p => p.codigo === codigo);
    },

    getProdutosByCategoria(categoriaId) {
        return db.getAll('produtos').filter(p => p.categoria_id === categoriaId);
    },

    getProdutosBaixoEstoque() {
        return db.getAll('produtos').filter(p => p.estoque <= (p.estoque_minimo || 5));
    },

    // ============================================================
    // MOVIMENTAÇÕES
    // ============================================================
    getMovimentacoes() {
        return db.getAll('movimentacoes');
    },

    getMovimentacoesByProduto(produtoId) {
        return db.getAll('movimentacoes').filter(m => m.produto_id === produtoId);
    },

    getMovimentacoesByPeriodo(inicio, fim) {
        return db.getAll('movimentacoes').filter(m => {
            const data = new Date(m.data);
            return data >= new Date(inicio) && data <= new Date(fim);
        });
    },

    // ============================================================
    // ENTRADA DE ESTOQUE
    // ============================================================
    entrada(produtoId, quantidade, motivo = 'Entrada manual', usuario = null) {
        const produto = this.getProduto(produtoId);
        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        const estoqueAnterior = produto.estoque;
        produto.estoque += quantidade;

        db.update('produtos', produtoId, produto);

        // Registrar movimentação
        const mov = {
            produto_id: produtoId,
            produto_nome: produto.nome,
            tipo: 'entrada',
            quantidade: quantidade,
            estoque_anterior: estoqueAnterior,
            estoque_atual: produto.estoque,
            motivo: motivo,
            usuario: usuario || 'Sistema',
            data: new Date().toISOString()
        };

        db.insert('movimentacoes', mov);
        return mov;
    },

    // ============================================================
    // SAÍDA DE ESTOQUE
    // ============================================================
    saida(produtoId, quantidade, motivo = 'Saída manual', usuario = null) {
        const produto = this.getProduto(produtoId);
        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        if (produto.estoque < quantidade) {
            throw new Error(`Estoque insuficiente. Disponível: ${produto.estoque}`);
        }

        const estoqueAnterior = produto.estoque;
        produto.estoque -= quantidade;

        db.update('produtos', produtoId, produto);

        // Registrar movimentação
        const mov = {
            produto_id: produtoId,
            produto_nome: produto.nome,
            tipo: 'saida',
            quantidade: quantidade,
            estoque_anterior: estoqueAnterior,
            estoque_atual: produto.estoque,
            motivo: motivo,
            usuario: usuario || 'Sistema',
            data: new Date().toISOString()
        };

        db.insert('movimentacoes', mov);
        return mov;
    },

    // ============================================================
    // AJUSTE DE ESTOQUE
    // ============================================================
    ajuste(produtoId, novoEstoque, motivo = 'Ajuste manual', usuario = null) {
        const produto = this.getProduto(produtoId);
        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        const diferenca = novoEstoque - produto.estoque;
        const tipo = diferenca >= 0 ? 'entrada' : 'saida';

        const estoqueAnterior = produto.estoque;
        produto.estoque = novoEstoque;

        db.update('produtos', produtoId, produto);

        // Registrar movimentação
        const mov = {
            produto_id: produtoId,
            produto_nome: produto.nome,
            tipo: tipo,
            quantidade: Math.abs(diferenca),
            estoque_anterior: estoqueAnterior,
            estoque_atual: produto.estoque,
            motivo: motivo + ' (Ajuste)',
            usuario: usuario || 'Sistema',
            data: new Date().toISOString()
        };

        db.insert('movimentacoes', mov);
        return mov;
    },

    // ============================================================
    // TRANSFERÊNCIA
    // ============================================================
    transferencia(produtoId, quantidade, origem, destino, usuario = null) {
        // Retirar da origem
        this.saida(produtoId, quantidade, `Transferência para ${destino}`, usuario);

        // Registrar transferência
        const produto = this.getProduto(produtoId);
        const mov = {
            produto_id: produtoId,
            produto_nome: produto.nome,
            quantidade: quantidade,
            origem: origem,
            destino: destino,
            usuario: usuario || 'Sistema',
            data_transferencia: new Date().toISOString(),
            status: 'Concluída'
        };

        db.insert('transferencias', mov);
        return mov;
    },

    // ============================================================
    // RESERVAR ESTOQUE
    // ============================================================
    reservar(produtoId, quantidade, motivo = 'Reserva', usuario = null) {
        const produto = this.getProduto(produtoId);
        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        if (produto.estoque < quantidade) {
            throw new Error(`Estoque insuficiente. Disponível: ${produto.estoque}`);
        }

        const estoqueAnterior = produto.estoque;
        produto.estoque_reservado = (produto.estoque_reservado || 0) + quantidade;

        db.update('produtos', produtoId, produto);

        // Registrar movimentação
        const mov = {
            produto_id: produtoId,
            produto_nome: produto.nome,
            tipo: 'reserva',
            quantidade: quantidade,
            estoque_anterior: estoqueAnterior,
            estoque_atual: produto.estoque,
            motivo: motivo,
            usuario: usuario || 'Sistema',
            data: new Date().toISOString()
        };

        db.insert('movimentacoes', mov);
        return mov;
    },

    // ============================================================
    // LIBERAR RESERVA
    // ============================================================
    liberarReserva(produtoId, quantidade, motivo = 'Liberação de reserva', usuario = null) {
        const produto = this.getProduto(produtoId);
        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        const estoqueAnterior = produto.estoque;
        produto.estoque_reservado = Math.max(0, (produto.estoque_reservado || 0) - quantidade);

        db.update('produtos', produtoId, produto);

        // Registrar movimentação
        const mov = {
            produto_id: produtoId,
            produto_nome: produto.nome,
            tipo: 'liberacao_reserva',
            quantidade: quantidade,
            estoque_anterior: estoqueAnterior,
            estoque_atual: produto.estoque,
            motivo: motivo,
            usuario: usuario || 'Sistema',
            data: new Date().toISOString()
        };

        db.insert('movimentacoes', mov);
        return mov;
    },

    // ============================================================
    // CATEGORIAS
    // ============================================================
    getCategorias() {
        return db.getAll('categorias');
    },

    getCategoria(id) {
        return db.get('categorias', id);
    },

    getCategoriasByPai(paiId) {
        return db.getAll('categorias').filter(c => c.pai_id === paiId);
    },

    // ============================================================
    // ESTATÍSTICAS
    // ============================================================
    getStats() {
        const produtos = this.getProdutos();
        const total = produtos.length;
        const valorEstoque = produtos.reduce((sum, p) => sum + (p.preco * p.estoque), 0);
        const baixoEstoque = produtos.filter(p => p.estoque <= (p.estoque_minimo || 5)).length;
        const semEstoque = produtos.filter(p => p.estoque === 0).length;

        return {
            total_produtos: total,
            valor_estoque: valorEstoque,
            baixo_estoque: baixoEstoque,
            sem_estoque: semEstoque
        };
    }
};

// ============================================================
// FUNÇÕES DE UI (integração com app.js)
// ============================================================

// Produtos
function updateProductsList() {
    const container = document.getElementById('productsList');
    const products = db.getAll('produtos');

    if (products.length === 0) {
        container.innerHTML = `<div class="loading">Nenhum produto cadastrado</div>`;
        return;
    }

    container.innerHTML = products.map(p => {
        const categoria = db.get('categorias', p.categoria_id);
        const isLow = p.estoque <= (p.estoque_minimo || 5);
        return `
            <div class="product-card">
                <div class="product-icon">📦</div>
                <div class="product-name">${p.nome}</div>
                <div class="product-code">${p.codigo}</div>
                <div class="product-price">AOA ${(p.preco || 0).toLocaleString()}</div>
                <div class="product-stock ${isLow ? 'low' : 'normal'}">Stock: ${p.estoque}</div>
                ${categoria ? `<div style="font-size:0.6rem;color:var(--text-muted);">${categoria.nome}</div>` : ''}
                <div class="product-actions">
                    <button onclick="editProduct(${p.id})" class="btn-sm btn-primary">✏️</button>
                    <button onclick="deleteProduct(${p.id})" class="btn-sm btn-danger">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function openProductModal() {
    state.editingProductId = null;
    document.getElementById('productModalTitle').textContent = '📦 Novo Produto';
    document.getElementById('productName').value = '';
    document.getElementById('productCode').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productCost').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productMinStock').value = '5';
    document.getElementById('productCategory').value = '';
    openModal('productModal');
}

function editProduct(id) {
    const product = db.get('produtos', id);
    if (!product) return;
    state.editingProductId = id;
    document.getElementById('productModalTitle').textContent = '✏️ Editar Produto';
    document.getElementById('productName').value = product.nome;
    document.getElementById('productCode').value = product.codigo;
    document.getElementById('productPrice').value = product.preco;
    document.getElementById('productCost').value = product.custo || '';
    document.getElementById('productStock').value = product.estoque;
    document.getElementById('productMinStock').value = product.estoque_minimo || 5;
    document.getElementById('productCategory').value = product.categoria_id || '';
    openModal('productModal');
}

function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const code = document.getElementById('productCode').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const cost = parseFloat(document.getElementById('productCost').value) || 0;
    const stock = parseInt(document.getElementById('productStock').value) || 0;
    const minStock = parseInt(document.getElementById('productMinStock').value) || 5;
    const categoria_id = document.getElementById('productCategory').value || null;

    if (!name || !code) {
        showToast('❌ Nome e código são obrigatórios!', 'error');
        return;
    }

    const data = {
        nome: name,
        codigo: code,
        preco: price,
        custo: cost,
        estoque: stock,
        estoque_minimo: minStock,
        categoria_id: categoria_id
    };

    if (state.editingProductId) {
        db.update('produtos', state.editingProductId, data);
        showToast('✅ Produto atualizado!', 'success');
    } else {
        db.insert('produtos', data);
        showToast('✅ Produto criado!', 'success');
    }

    closeModal('productModal');
    updateProductsList();
    updatePDVProducts();
    updateUI();
}

function deleteProduct(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        db.delete('produtos', id);
        updateProductsList();
        updatePDVProducts();
        updateUI();
        showToast('🗑️ Produto excluído', 'info');
    }
}

function exportarProdutos() {
    const products = db.getAll('produtos');
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Produtos exportados!', 'success');
}

function importarProdutos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const products = JSON.parse(event.target.result);
                if (!Array.isArray(products)) throw new Error('Formato inválido');

                for (const p of products) {
                    db.insert('produtos', p);
                }

                showToast(`📥 ${products.length} produtos importados!`, 'success');
                updateProductsList();
                updatePDVProducts();
                updateUI();
            } catch (error) {
                showToast('❌ Erro ao importar: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Movimentações
function updateMovimentacoesList() {
    const container = document.getElementById('movimentacoesList');
    const movimentacoes = db.getAll('movimentacoes');

    if (movimentacoes.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma movimentação registrada</td></tr>`;
        return;
    }

    container.innerHTML = movimentacoes.slice(0, 50).map(m => {
        const tipoIcon = m.tipo === 'entrada' ? '📥 Entrada' : m.tipo === 'saida' ? '📤 Saída' : '🔄 Ajuste';
        const tipoColor = m.tipo === 'entrada' ? 'var(--success)' : m.tipo === 'saida' ? 'var(--danger)' : 'var(--warning)';
        return `
            <tr>
                <td>${m.produto_nome}</td>
                <td><span style="color:${tipoColor};">${tipoIcon}</span></td>
                <td>${m.tipo === 'entrada' ? '+' : '-'} ${m.quantidade}</td>
                <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
                <td>${m.motivo || '-'}</td>
                <td>${m.usuario || '-'}</td>
            </tr>
        `;
    }).join('');
}

function exportarMovimentacoes() {
    const movimentacoes = db.getAll('movimentacoes');
    if (movimentacoes.length === 0) {
        showToast('❌ Nenhuma movimentação para exportar', 'warning');
        return;
    }

    let csv = 'Produto,Tipo,Quantidade,Data,Motivo,Usuário\n';
    for (const m of movimentacoes) {
        csv += `${m.produto_nome},${m.tipo},${m.quantidade},${new Date(m.data).toLocaleDateString('pt-BR')},${m.motivo || ''},${m.usuario || ''}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Movimentações exportadas!', 'success');
}

function filtrarMovimentacoes() {
    const produto = prompt('Digite o nome do produto para filtrar (deixe em branco para todos):');
    const container = document.getElementById('movimentacoesList');
    let movimentacoes = db.getAll('movimentacoes');

    if (produto && produto.trim()) {
        movimentacoes = movimentacoes.filter(m => 
            m.produto_nome?.toLowerCase().includes(produto.toLowerCase())
        );
    }

    if (movimentacoes.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma movimentação encontrada</td></tr>`;
        return;
    }

    container.innerHTML = movimentacoes.slice(0, 50).map(m => {
        const tipoIcon = m.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída';
        const tipoColor = m.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)';
        return `
            <tr>
                <td>${m.produto_nome}</td>
                <td><span style="color:${tipoColor};">${tipoIcon}</span></td>
                <td>${m.tipo === 'entrada' ? '+' : '-'} ${m.quantidade}</td>
                <td>${new Date(m.data).toLocaleDateString('pt-BR')}</td>
                <td>${m.motivo || '-'}</td>
                <td>${m.usuario || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Transferências
function updateTransferenciasList() {
    const container = document.getElementById('transferenciasList');
    const transferencias = db.getAll('transferencias');

    if (transferencias.length === 0) {
        container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma transferência registrada</td></tr>`;
        return;
    }

    container.innerHTML = transferencias.slice(0, 20).map(t => {
        const statusClass = t.status === 'Concluída' ? 'success' : t.status === 'Cancelada' ? 'danger' : 'warning';
        return `
            <tr>
                <td>${t.produto_nome}</td>
                <td>${t.origem}</td>
                <td>${t.destino}</td>
                <td>${t.quantidade}</td>
                <td>${new Date(t.data_transferencia || t.data).toLocaleDateString('pt-BR')}</td>
            </tr>
        `;
    }).join('');
}

// Categorias
function updateCategoriasList() {
    const container = document.getElementById('categoriesGrid');
    const categorias = db.getAll('categorias');

    if (categorias.length === 0) {
        container.innerHTML = `<div class="loading">Nenhuma categoria cadastrada</div>`;
        return;
    }

    container.innerHTML = categorias.map(c => {
        const pai = db.get('categorias', c.pai_id);
        return `
            <div class="category-card">
                <i class="fas ${c.icone || 'fa-tag'}" style="font-size:2rem;color:${c.cor || 'var(--primary)'};"></i>
                <h4>${c.nome}</h4>
                <p style="font-size:0.7rem;color:var(--text-muted);">${c.descricao || ''}</p>
                ${pai ? `<span style="font-size:0.6rem;color:var(--text-muted);">Subcategoria de: ${pai.nome}</span>` : ''}
                <div style="display:flex;gap:4px;margin-top:8px;justify-content:center;">
                    <button onclick="editCategoria(${c.id})" class="btn-sm btn-primary">✏️</button>
                    <button onclick="deleteCategoria(${c.id})" class="btn-sm btn-danger">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function openCategoriaModal() {
    state.editingCategoriaId = null;
    document.getElementById('categoriaModalTitle').textContent = '🏷️ Nova Categoria';
    document.getElementById('categoriaNome').value = '';
    document.getElementById('categoriaDescricao').value = '';
    document.getElementById('categoriaIcone').value = 'fa-tag';
    document.getElementById('categoriaCor').value = '#1a3a5c';
    loadCategoriaPai();
    openModal('categoriaModal');
}

function loadCategoriaPai() {
    const select = document.getElementById('categoriaPai');
    if (!select) return;
    select.innerHTML = '<option value="">Nenhuma (Raiz)</option>';
    const categorias = db.getAll('categorias');
    categorias.forEach(c => {
        if (state.editingCategoriaId && c.id === state.editingCategoriaId) return;
        select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
}

function editCategoria(id) {
    const categoria = db.get('categorias', id);
    if (!categoria) return;
    state.editingCategoriaId = id;
    document.getElementById('categoriaModalTitle').textContent = '✏️ Editar Categoria';
    document.getElementById('categoriaNome').value = categoria.nome;
    document.getElementById('categoriaDescricao').value = categoria.descricao || '';
    document.getElementById('categoriaIcone').value = categoria.icone || 'fa-tag';
    document.getElementById('categoriaCor').value = categoria.cor || '#1a3a5c';
    loadCategoriaPai();
    document.getElementById('categoriaPai').value = categoria.pai_id || '';
    openModal('categoriaModal');
}

function saveCategoria() {
    const nome = document.getElementById('categoriaNome').value.trim();
    const descricao = document.getElementById('categoriaDescricao').value.trim();
    const icone = document.getElementById('categoriaIcone').value || 'fa-tag';
    const cor = document.getElementById('categoriaCor').value || '#1a3a5c';
    const pai_id = document.getElementById('categoriaPai').value || null;

    if (!nome) {
        showToast('❌ Nome é obrigatório!', 'error');
        return;
    }

    const data = { nome, descricao, icone, cor, pai_id };

    if (state.editingCategoriaId) {
        db.update('categorias', state.editingCategoriaId, data);
        showToast('✅ Categoria atualizada!', 'success');
    } else {
        db.insert('categorias', data);
        showToast('✅ Categoria criada!', 'success');
    }

    closeModal('categoriaModal');
    updateCategoriasList();
    loadCategoriasSelect();
    updateUI();
}

function deleteCategoria(id) {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
        const produtos = db.getAll('produtos').filter(p => p.categoria_id === id);
        if (produtos.length > 0) {
            showToast(`❌ Não é possível excluir: ${produtos.length} produtos usam esta categoria`, 'error');
            return;
        }
        db.delete('categorias', id);
        updateCategoriasList();
        loadCategoriasSelect();
        updateUI();
        showToast('🗑️ Categoria excluída', 'info');
    }
}

// PDV
function updatePDVProducts(search = '') {
    const container = document.getElementById('pdvProducts');
    let products = db.getAll('produtos');

    if (search) {
        search = search.toLowerCase();
        products = products.filter(p =>
            p.nome?.toLowerCase().includes(search) ||
            p.codigo?.toLowerCase().includes(search)
        );
    }

    if (products.length === 0) {
        container.innerHTML = `<div class="loading">Nenhum produto encontrado</div>`;
        return;
    }

    container.innerHTML = products.map(p => {
        const inCart = state.cart.find(c => c.id === p.id);
        return `
            <div class="pdv-product ${inCart ? 'in-cart' : ''}" onclick="addToCart(${p.id})">
                <div style="font-size:1.5rem;">📦</div>
                <div style="font-weight:600;font-size:0.7rem;">${p.nome}</div>
                <div class="pdv-price">AOA ${(p.preco || 0).toLocaleString()}</div>
                <div class="pdv-stock">Stock: ${p.estoque}</div>
                ${inCart ? `<span class="pdv-qty">${inCart.quantity}x</span>` : ''}
            </div>
        `;
    }).join('');
}

function searchProducts(value) {
    updatePDVProducts(value);
}

function addToCart(productId) {
    const product = db.get('produtos', productId);
    if (!product || product.estoque <= 0) {
        showToast('❌ Produto sem estoque!', 'error');
        return;
    }

    const existing = state.cart.find(c => c.id === productId);
    if (existing) {
        if (existing.quantity < product.estoque) {
            existing.quantity++;
        } else {
            showToast('❌ Estoque insuficiente!', 'error');
            return;
        }
    } else {
        state.cart.push({ ...product, quantity: 1 });
    }

    updateCart();
    updatePDVProducts();
    showToast(`✅ ${product.nome} adicionado`, 'success');
}

function updateCart() {
    const container = document.getElementById('cartItems');
    const total = state.cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);

    document.getElementById('cartItemCount').textContent = 
        `${state.cart.reduce((sum, i) => sum + i.quantity, 0)} itens`;
    document.getElementById('cartTotal').textContent = `AOA ${total.toLocaleString()}`;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-icon">🛒</div>
                <div>Carrinho vazio</div>
            </div>
        `;
        return;
    }

    container.innerHTML = state.cart.map((item, index) => `
        <div class="cart-item">
            <div>
                <div class="item-name">${item.nome}</div>
                <div class="item-detail">AOA ${item.preco} x ${item.quantity}</div>
            </div>
            <div class="item-actions">
                <button class="btn-qty" onclick="updateCartQuantity(${index}, -1)">−</button>
                <span style="font-weight:600;min-width:20px;text-align:center;">${item.quantity}</span>
                <button class="btn-qty" onclick="updateCartQuantity(${index}, 1)">+</button>
                <button class="btn-remove" onclick="removeFromCart(${index})">✕</button>
            </div>
        </div>
    `).join('');
}

function updateCartQuantity(index, delta) {
    const item = state.cart[index];
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) { removeFromCart(index); return; }
    if (newQty > item.estoque) { showToast('❌ Estoque insuficiente!', 'error'); return; }
    item.quantity = newQty;
    updateCart();
    updatePDVProducts();
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCart();
    updatePDVProducts();
    showToast('🗑️ Item removido', 'info');
}

function clearCart() {
    if (state.cart.length === 0) return;
    if (confirm('Limpar todo o carrinho?')) {
        state.cart = [];
        updateCart();
        updatePDVProducts();
        showToast('🧹 Carrinho limpo', 'info');
    }
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
if (typeof window !== 'undefined') {
    window.ESTOQUE = ESTOQUE;
    window.updateProductsList = updateProductsList;
    window.openProductModal = openProductModal;
    window.editProduct = editProduct;
    window.saveProduct = saveProduct;
    window.deleteProduct = deleteProduct;
    window.exportarProdutos = exportarProdutos;
    window.importarProdutos = importarProdutos;
    window.updatePDVProducts = updatePDVProducts;
    window.searchProducts = searchProducts;
    window.addToCart = addToCart;
    window.updateCart = updateCart;
    window.updateCartQuantity = updateCartQuantity;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.updateMovimentacoesList = updateMovimentacoesList;
    window.exportarMovimentacoes = exportarMovimentacoes;
    window.filtrarMovimentacoes = filtrarMovimentacoes;
    window.updateTransferenciasList = updateTransferenciasList;
    window.updateCategoriasList = updateCategoriasList;
    window.openCategoriaModal = openCategoriaModal;
    window.editCategoria = editCategoria;
    window.saveCategoria = saveCategoria;
    window.deleteCategoria = deleteCategoria;
}

console.log('✅ estoque.js carregado!');