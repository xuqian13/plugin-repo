// 全局变量
let allPlugins = [];
let filteredPlugins = [];

// DOM 元素
const pluginsGrid = document.getElementById('plugins-grid');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const loadingDiv = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const pluginCount = document.getElementById('plugin-count');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 确保页面加载时关闭所有可能存在的模态框
    closeModal();
    
    await loadPlugins();
    setupEventListeners();
});

// 加载插件数据
async function loadPlugins() {
    const urls = [
        'https://raw.githubusercontent.com/MaiM-with-u/plugin-repo/main/plugin_details.json',
        // 备用 URL，如果主 URL 失败
        'https://cdn.jsdelivr.net/gh/MaiM-with-u/plugin-repo@main/plugin_details.json'
    ];
    
    for (const url of urls) {
        try {
            console.log('正在从以下地址加载插件数据:', url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            allPlugins = await response.json();
            filteredPlugins = [...allPlugins];
            
            pluginCount.textContent = allPlugins.length;
            renderPlugins();
            hideLoading();
            console.log('✅ 插件数据加载成功');
            return;
        } catch (error) {
            console.warn(`从 ${url} 加载失败:`, error);
            continue;
        }
    }
    
    // 如果所有 URL 都失败了
    try {
        throw new Error('无法从任何数据源加载插件数据');
    } catch (error) {
        console.error('加载插件数据失败:', error);
        showError('加载插件数据失败，请稍后重试。可能是网络问题或数据源暂不可用。');
        hideLoading();
    }
}

// 设置事件监听器
function setupEventListeners() {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    sortSelect.addEventListener('change', handleSort);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 处理搜索
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredPlugins = [...allPlugins];
    } else {
        filteredPlugins = allPlugins.filter(plugin => 
            plugin.manifest.name.toLowerCase().includes(searchTerm) ||
            plugin.manifest.description.toLowerCase().includes(searchTerm) ||
            plugin.manifest.author.name.toLowerCase().includes(searchTerm) ||
            (plugin.manifest.keywords || []).some(keyword => 
                keyword.toLowerCase().includes(searchTerm)
            )
        );
    }
    
    renderPlugins();
}

// 处理排序
function handleSort() {
    const sortBy = sortSelect.value;
    
    filteredPlugins.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.manifest.name.localeCompare(b.manifest.name);
            case 'version':
                return compareVersions(b.manifest.version, a.manifest.version);
            case 'author':
                return a.manifest.author.name.localeCompare(b.manifest.author.name);
            default:
                return 0;
        }
    });
    
    renderPlugins();
}

// 版本比较函数
function compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart > bPart) {
            return 1;
        }
        if (aPart < bPart) {
            return -1;
        }
    }
    
    return 0;
}

// 渲染插件列表
async function renderPlugins() {
    if (filteredPlugins.length === 0) {
        pluginsGrid.innerHTML = '';
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    
    // 清空现有内容
    pluginsGrid.innerHTML = '';
    
    // 分批渲染卡片，提供更好的用户体验
    const batchSize = 6;
    for (let i = 0; i < filteredPlugins.length; i += batchSize) {
        const batch = filteredPlugins.slice(i, i + batchSize);
        const pluginCards = await Promise.all(
            batch.map(plugin => createPluginCard(plugin))
        );
        
        // 创建临时容器并添加动画延迟
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = pluginCards.join('');
        
        // 逐个添加卡片到网格中
        Array.from(tempContainer.children).forEach((card, index) => {
            card.style.animationDelay = `${(i + index) * 0.1}s`;
            pluginsGrid.appendChild(card);
        });
        
        // 如果不是最后一批，添加小延迟
        if (i + batchSize < filteredPlugins.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

// 创建插件卡片
async function createPluginCard(plugin) {
    const { manifest } = plugin;
    const keywords = manifest.keywords || [];
    const repositoryUrl = await getRepositoryUrl(plugin.id);
    
    return `
        <div class="card bg-base-100 shadow-lg plugin-card border hover:border-primary hover:shadow-xl transition-all duration-200 cursor-pointer">
            <div class="card-body"onclick="event.stopPropagation(); showPluginDetails('${escapeHtml(plugin.id)}')">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="card-title text-lg">
                        <i class="fas fa-puzzle-piece text-primary mr-2"></i>
                        ${escapeHtml(manifest.name)}
                    </h3>
                    <div class="badge badge-primary badge-outline">${escapeHtml(manifest.version)}</div>
                </div>
                
                <p class="text-sm text-base-content/70 mb-3 line-clamp-3">
                    ${escapeHtml(manifest.description)}
                </p>
                
                <div class="flex items-center mb-3">
                    <i class="fas fa-user text-sm text-base-content/60 mr-2"></i>
                    <span class="text-sm text-base-content/80">
                        ${escapeHtml(manifest.author.name)}
                    </span>
                </div>
                
                <div class="mb-3">
                    <div class="flex items-center mb-1">
                        <i class="fas fa-cog text-sm text-base-content/60 mr-2"></i>
                        <span class="text-xs text-base-content/70">兼容: ${escapeHtml(manifest.host_application.min_version)}+</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-balance-scale text-sm text-base-content/60 mr-2"></i>
                        <span class="text-xs text-base-content/70">${escapeHtml(manifest.license)}</span>
                    </div>
                </div>
                
                ${keywords.length > 0 ? `
                    <div class="mb-4">
                        <div class="flex flex-wrap gap-1">
                            ${keywords.slice(0, 3).map(keyword => 
                                `<span class="badge badge-secondary badge-sm">${escapeHtml(keyword)}</span>`
                            ).join('')}
                            ${keywords.length > 3 ? 
                                `<span class="badge badge-ghost badge-sm">+${keywords.length - 3}</span>` 
                                : ''
                            }
                        </div>
                    </div>
                ` : ''}
                
                <div class="card-actions justify-between items-center">
                    <div class="flex gap-2">
                        ${repositoryUrl ? `
                            <a href="${escapeHtml(repositoryUrl)}" target="_blank" 
                               class="btn btn-outline btn-xs" onclick="event.stopPropagation();">
                                <i class="fab fa-github mr-1"></i>
                                源码
                            </a>
                        ` : ''}
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showPluginDetails('${escapeHtml(plugin.id)}')">
                        <i class="fas fa-info-circle mr-1"></i>
                        查看详情
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 获取仓库 URL（从插件 ID 推断或从原始数据获取）
async function getRepositoryUrl(pluginId) {
    const urls = [
        'https://raw.githubusercontent.com/MaiM-with-u/plugin-repo/main/plugins.json',
        'https://cdn.jsdelivr.net/gh/MaiM-with-u/plugin-repo@main/plugins.json'
    ];
    
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const plugins = await response.json();
                const plugin = plugins.find(p => p.id === pluginId);
                return plugin ? plugin.repositoryUrl : null;
            }
        } catch (error) {
            console.warn(`从 ${url} 获取插件数据失败:`, error);
            continue;
        }
    }
    
    console.warn('无法获取原始插件数据，所有数据源都失败');
    return null;
}

// 显示插件详情模态框
function showPluginDetails(pluginId) {
    const plugin = allPlugins.find(p => p.id === pluginId);
    if (!plugin) {
        return;
    }
    
    // 先关闭已存在的模态框
    closeModal();
    
    const { manifest } = plugin;
    const modalContent = `
        <div class="modal modal-open" id="plugin-detail-modal">
            <div class="modal-box max-w-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg">
                        <i class="fas fa-puzzle-piece text-primary mr-2"></i>
                        ${escapeHtml(manifest.name)}
                    </h3>
                    <button class="btn btn-sm btn-circle btn-ghost" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="stat bg-base-200 rounded-lg">
                        <div class="stat-title">版本</div>
                        <div class="stat-value text-primary text-lg">${escapeHtml(manifest.version)}</div>
                    </div>
                    <div class="stat bg-base-200 rounded-lg">
                        <div class="stat-title">协议版本</div>
                        <div class="stat-value text-lg">${escapeHtml(manifest.manifest_version)}</div>
                    </div>
                </div>
                
                <div class="mb-4">
                    <h4 class="font-semibold mb-2">描述</h4>
                    <p class="text-base-content/80">${escapeHtml(manifest.description)}</p>
                </div>
                
                <div class="mb-4">
                    <h4 class="font-semibold mb-2">作者信息</h4>
                    <div class="flex items-center">
                        <i class="fas fa-user mr-2 text-base-content/60"></i>
                        <a href="${escapeHtml(manifest.author.url)}" target="_blank" 
                           class="link link-primary">${escapeHtml(manifest.author.name)}</a>
                    </div>
                </div>
                
                <div class="mb-4">
                    <h4 class="font-semibold mb-2">兼容性</h4>
                    <div class="bg-base-200 p-3 rounded-lg">
                        <div class="flex items-center">
                            <i class="fas fa-cog mr-2 text-base-content/60"></i>
                            <span>最低版本: ${escapeHtml(manifest.host_application.min_version)}</span>
                        </div>
                        ${manifest.host_application.max_version ? `
                            <div class="flex items-center mt-1">
                                <i class="fas fa-cog mr-2 text-base-content/60"></i>
                                <span>最高版本: ${escapeHtml(manifest.host_application.max_version)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${manifest.keywords && manifest.keywords.length > 0 ? `
                    <div class="mb-4">
                        <h4 class="font-semibold mb-2">标签</h4>
                        <div class="flex flex-wrap gap-2">
                            ${manifest.keywords.map(keyword => 
                                `<span class="badge badge-secondary">${escapeHtml(keyword)}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
                  <div class="modal-action">
                    <button class="btn btn-outline" onclick="closeModal()">
                        <i class="fas fa-times mr-1"></i>
                        关闭
                    </button>
                </div>
            </div>
            <div class="modal-backdrop" onclick="closeModal()"></div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // 添加键盘支持（ESC键关闭）
    document.addEventListener('keydown', handleModalKeydown);
}

// 处理模态框键盘事件
function handleModalKeydown(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

// 关闭模态框
function closeModal() {
    const modal = document.querySelector('#plugin-detail-modal');
    if (modal) {
        modal.remove();
        // 移除键盘事件监听器
        document.removeEventListener('keydown', handleModalKeydown);
    }
}

// 工具函数
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
}

function showEmptyState() {
    emptyState.classList.remove('hidden');
}

function hideEmptyState() {
    emptyState.classList.add('hidden');
}

function showError(message) {
    pluginsGrid.innerHTML = `
        <div class="col-span-full text-center py-12">
            <i class="fas fa-exclamation-triangle text-6xl text-error mb-4"></i>
            <p class="text-xl text-error">${escapeHtml(message)}</p>
        </div>
    `;
}

// 主题切换
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// 加载保存的主题
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
});
