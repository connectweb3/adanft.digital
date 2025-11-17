// ===== State =====
let theme = 'crt';
let activeIndex = 0;
let modalItem = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 5;

// ===== Ownership / Blockfrost Config =====
const POLICY_ID = '8b4c0f58a7867340274effce4d8a9fb9e07d0bd7abed672fb0bce75c';
const BLOCKFROST_PROJECT_ID = 'mainnetvjYI2rsQK0AoLOIcy5OulXHczrQRIiOQ';
const MINT_URL = 'https://www.jpg.store/collection/obracardanoblocks?tab=minting';

// ===== Elements =====
const gridEl = document.getElementById('grid');
const countLabel = document.getElementById('countLabel');
const yearEl = document.getElementById('year');
const searchInput = document.getElementById('searchInput');

const modalEl = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalTile = document.getElementById('modalTile');
const modalId = document.getElementById('modalId');
const modalTitle = document.getElementById('modalTitle');
const modalMeta = document.getElementById('modalMeta');
const modalDesc = document.getElementById('modalDesc');
const modalTags = document.getElementById('modalTags');
const modalPalette = document.getElementById('modalPalette');

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initializeThemeButtons();
    initializeYear();
    initializeEventListeners();
    initializeApp();
});

function initializeThemeButtons() {
    document.getElementById('themeCrt').addEventListener('click', () => setTheme('crt'));
    document.getElementById('themeDark').addEventListener('click', () => setTheme('dark'));
    document.getElementById('themeLight').addEventListener('click', () => setTheme('light'));
}

function initializeYear() {
    yearEl.textContent = new Date().getFullYear();
}

function initializeEventListeners() {
    window.addEventListener('keydown', handleKeyDown);
    modalClose.addEventListener('click', closeModal);
    modalEl.addEventListener('click', handleModalClick);
    searchInput.addEventListener('input', handleSearch);
}

function initializeApp() {
    renderGrid();
    countLabel.textContent = ARTWORKS.length + ' item(s)';
}

/**
 * ===== Helper Functions =====
 * Ownership helpers (Blockfrost) are defined here so openModal/addActionButtons can call them.
 */
const BLOCKFROST_BASE = 'https://cardano-mainnet.blockfrost.io/api/v0';

function asciiToHex(str) {
    return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

function getAssetIdFromArtwork(artwork) {
    // Asset name must sync with the id key from data.js (e.g., "blocks001")
    const assetNameHex = asciiToHex(artwork.id);
    return POLICY_ID + assetNameHex;
}

function getAssetIdFromName(name) {
    // Fallback builder using a provided asset name (e.g., artwork.title like "adaartblocks001")
    const assetNameHex = asciiToHex(name);
    return POLICY_ID + assetNameHex;
}

async function fetchAssetAddresses(assetId) {
    const res = await fetch(`${BLOCKFROST_BASE}/assets/${assetId}/addresses`, {
        headers: {
            project_id: BLOCKFROST_PROJECT_ID
        }
    });
    if (res.status === 404) {
        // Asset doesn't exist (not minted yet)
        return [];
    }
    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Blockfrost error ${res.status}: ${msg}`);
    }
    return res.json();
}

function shortenAddress(addr) {
    if (!addr) return '';
    return addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-10)}` : addr;
}

async function updateOwnershipUI(artwork, ownersButton, bidButton) {
    try {
        const sub = ownersButton.querySelector('.owners-sub');
        if (sub) sub.textContent = 'Checking ownership...';

        const assetIdPrimary = getAssetIdFromArtwork(artwork); // uses id key (e.g., "blocks001")
        let chosenAssetId = assetIdPrimary;
        let addresses = await fetchAssetAddresses(assetIdPrimary);

        // Fallback: some minted assets may use a different on-chain name (e.g., "adaartblocks001")
        if (!addresses || addresses.length === 0) {
            const assetIdAlt = getAssetIdFromName(artwork.title);
            const alt = await fetchAssetAddresses(assetIdAlt);
            if (alt && alt.length > 0) {
                addresses = alt;
                chosenAssetId = assetIdAlt;
            }
        }

        if (!addresses || addresses.length === 0) {
            // Not minted yet: update UI and wire CTA to minting link
            if (sub) sub.textContent = 'NO MINTED YET – Mint now';
            // Bid button: keep as "Coming Soon" and no action
            if (bidButton) {
                const bidSub = bidButton.querySelector('.bid-sub');
                if (bidSub) bidSub.textContent = 'Coming Soon';
                bidButton.onclick = null;
            }
            // Owners button links to mint page
            ownersButton.onclick = () => window.open(MINT_URL, '_blank');
            ownersButton.classList.remove('border-emerald-400/30', 'bg-emerald-400/10', 'hover:bg-emerald-400/20');
            ownersButton.classList.add('border-amber-400/30', 'bg-amber-400/10', 'hover:bg-amber-400/20');
            return;
        }

        // Minted: show current holder (quantity > 0)
        const holder = addresses.find(a => a.quantity && a.quantity !== '0') || addresses[0];
        const addr = holder.address;
        if (sub) sub.innerHTML = `Owner: <span class="font-mono">${shortenAddress(addr)}</span>`;
        ownersButton.title = addr;
        // Link OWNER button to JPG Store user page
        ownersButton.onclick = () => window.open(`https://www.jpg.store/user/${addr}`, '_blank');

        // Link BID button to JPG Store asset page
        if (bidButton) {
            const bidSub = bidButton.querySelector('.bid-sub');
            if (bidSub) bidSub.textContent = 'View on JPG Store';
            bidButton.onclick = () => window.open(`https://www.jpg.store/asset/${chosenAssetId}`, '_blank');
        }
    } catch (err) {
        console.error('Ownership check failed:', err);
        const sub = ownersButton.querySelector('.owners-sub');
        if (sub) sub.textContent = 'Owner: Unknown (network error)';
    }
}
function renderGrid(filteredArtworks = ARTWORKS) {
    gridEl.innerHTML = '';
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredArtworks.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredArtworks.length);
    const currentArtworks = filteredArtworks.slice(startIndex, endIndex);
    
    countLabel.textContent = `${filteredArtworks.length} item(s) - Page ${currentPage} of ${totalPages}`;
    
    // Render current page items
    currentArtworks.forEach((artwork, index) => {
        const button = createGridButton(artwork, startIndex + index);
        gridEl.appendChild(button);
    });
    
    // Add pagination controls
    addPaginationControls(totalPages, filteredArtworks.length);
}

function filterArtworks(searchTerm) {
    if (!searchTerm.trim()) {
        return ARTWORKS;
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    return ARTWORKS.filter(artwork => {
        // Search in title/name
        if (artwork.title.toLowerCase().includes(term) || 
            artwork.id.toLowerCase().includes(term)) {
            return true;
        }
        
        // Search in tags
        if (artwork.tags.some(tag => tag.toLowerCase().includes(term))) {
            return true;
        }
        
        // Search in metadata
        const metadata = artwork.metadata;
        if (metadata.code.toLowerCase().includes(term) ||
            metadata.engine.toLowerCase().includes(term) ||
            metadata.quinity.toLowerCase().includes(term) ||
            metadata.space.toLowerCase().includes(term) ||
            metadata.colorway.toLowerCase().includes(term) ||
            metadata['code rarity'].toLowerCase().includes(term) ||
            metadata['engine rarity'].toLowerCase().includes(term) ||
            metadata['quinity rarity'].toLowerCase().includes(term) ||
            metadata['space rarity'].toLowerCase().includes(term) ||
            metadata['colorway rarity'].toLowerCase().includes(term)) {
            return true;
        }
        
        return false;
    });
}

function createGridButton(artwork, index) {
    const button = document.createElement('button');
    button.className = 'group rounded-xl overflow-hidden border text-left transition border-white/15 hover:border-white/35';
    button.addEventListener('mouseenter', () => { activeIndex = index; });
    button.addEventListener('click', () => openModal(artwork));
    
    // Create NFT image
    const imageContainer = document.createElement('div');
    imageContainer.className = 'w-full aspect-square overflow-hidden bg-black/20';
    
    const img = document.createElement('img');
    img.src = artwork.image;
    img.alt = artwork.title;
    img.className = 'w-full h-full object-cover transition-transform group-hover:scale-105';
    img.loading = 'lazy';
    
    imageContainer.appendChild(img);
    button.appendChild(imageContainer);
    
    // Create info section
    const info = document.createElement('div');
    info.className = 'p-2';
    info.innerHTML = `
        <div class="text-xs opacity-60">${artwork.id}</div>
        <div class="text-sm font-medium truncate">${artwork.title}</div>
        <div class="mt-1 flex flex-wrap gap-1">
            ${artwork.tags.slice(0, 3).map(tag => 
                `<span class='text-[10px] px-1.5 py-0.5 rounded border border-white/15 opacity-70'>${tag}</span>`
            ).join('')}
        </div>
    `;
    button.appendChild(info);
    
    return button;
}

function openModal(artwork) {
    modalItem = artwork;
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    
    modalId.textContent = artwork.id;
    modalTitle.textContent = artwork.title;
    modalMeta.textContent = `${artwork.year} • ${artwork.rarity}`;
    modalDesc.textContent = artwork.description;
    
    modalTags.innerHTML = artwork.tags.map(tag => 
        `<span class='text-[10px] px-1.5 py-0.5 rounded border border-white/15 opacity-80'>#${tag}</span>`
    ).join(' ');
    
    // Show NFT image in modal
    modalTile.innerHTML = '';
    const modalImg = document.createElement('img');
    modalImg.src = artwork.image;
    modalImg.alt = artwork.title;
    modalImg.className = 'w-full h-full object-contain';
    modalTile.appendChild(modalImg);
    
    // Show NFT metadata details
    modalPalette.innerHTML = `
        <div class="space-y-2 text-xs">
            <div><strong>Code:</strong> ${artwork.metadata.code} (${artwork.metadata['code rarity']})</div>
            <div><strong>Engine:</strong> ${artwork.metadata.engine} (${artwork.metadata['engine rarity']})</div>
            <div><strong>Quinity:</strong> ${artwork.metadata.quinity} (${artwork.metadata['quinity rarity']})</div>
            <div><strong>Space:</strong> ${artwork.metadata.space} (${artwork.metadata['space rarity']})</div>
            <div><strong>Colorway:</strong> ${artwork.metadata.colorway} (${artwork.metadata['colorway rarity']})</div>
        </div>
    `;
    
    // Add OWNERS and BID buttons
    addActionButtons(artwork);
}

function addActionButtons(artwork) {
    // Remove existing action buttons if they exist
    const existingButtons = document.querySelector('.action-buttons');
    if (existingButtons) {
        existingButtons.remove();
    }
    
    // Create action buttons container
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons flex gap-3 mt-4';
    
    // OWNERS button
    const ownersButton = document.createElement('button');
    ownersButton.className = 'owners-btn flex-1 px-4 py-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors text-sm font-medium';
    ownersButton.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            <span>OWNERS</span>
        </div>
        <div class="owners-sub text-xs opacity-70 mt-1">Checking ownership...</div>
    `;
    
    // BID button
    const bidButton = document.createElement('button');
    bidButton.className = 'bid-btn flex-1 px-4 py-2 rounded-xl border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 transition-colors text-sm font-medium';
    bidButton.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>BID</span>
        </div>
        <div class="bid-sub text-xs opacity-70 mt-1">Coming Soon</div>
    `;
    
    // Bid button click will be set by ownership status (minted -> link to asset; not minted -> no action)
    // No default click listener here.
    
    actionButtons.appendChild(ownersButton);
    actionButtons.appendChild(bidButton);
    
    // Add buttons to modal content area (after palette)
    modalPalette.parentNode.appendChild(actionButtons);

    // Fetch & display ownership info for this NFT in the modal
    updateOwnershipUI(artwork, ownersButton, bidButton);
}

function showBidAlert() {
    // Create custom alert modal
    const alertModal = document.createElement('div');
    alertModal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80';
    alertModal.innerHTML = `
        <div class="relative w-full max-w-sm rounded-2xl border border-amber-400/30 bg-black/80 backdrop-blur-md overflow-hidden z-[101]">
            <div class="p-6 text-center">
                <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-amber-300 mb-2">Bidding Coming Soon</h3>
                <p class="text-sm opacity-80 mb-4">The bidding feature is currently under development. Stay tuned for updates!</p>
                <button class="bid-alert-close px-4 py-2 rounded-xl border border-amber-400 bg-amber-400/20 hover:bg-amber-400/30 transition-colors text-sm">
                    Got it
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(alertModal);
    
    // Add close functionality
    const closeBtn = alertModal.querySelector('.bid-alert-close');
    closeBtn.addEventListener('click', () => {
        alertModal.remove();
    });
    
    // Close on background click
    alertModal.addEventListener('click', (e) => {
        if (e.target === alertModal) {
            alertModal.remove();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            alertModal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function closeModal() {
    modalEl.classList.remove('flex');
    modalEl.classList.add('hidden');
    modalItem = null;
}

function setTheme(nextTheme) {
    theme = nextTheme;
    const body = document.body;
    
    switch (nextTheme) {
        case 'crt':
            body.className = 'min-h-screen bg-[#0a0f0a] text-emerald-300 selection:bg-emerald-500/30';
            break;
        case 'dark':
            body.className = 'min-h-screen bg-[#0b0b10] text-slate-200 selection:bg-cyan-500/30';
            break;
        case 'light':
            body.className = 'min-h-screen bg-zinc-50 text-zinc-900 selection:bg-violet-500/20';
            break;
    }
}

// ===== Event Handlers =====
function handleKeyDown(event) {
    switch (event.key) {
        case 'Escape':
            if (!modalEl.classList.contains('hidden')) {
                closeModal();
            }
            break;
        case 'ArrowRight':
            if (modalEl.classList.contains('hidden')) {
                activeIndex = Math.min(activeIndex + 1, ARTWORKS.length - 1);
            }
            break;
        case 'ArrowLeft':
            if (modalEl.classList.contains('hidden')) {
                activeIndex = Math.max(activeIndex - 1, 0);
            }
            break;
        case 'Enter':
            if (modalEl.classList.contains('hidden')) {
                if (ARTWORKS[activeIndex]) {
                    openModal(ARTWORKS[activeIndex]);
                }
            }
            break;
    }
}

function handleModalClick(event) {
    if (event.target === modalEl) {
        closeModal();
    }
}

function addPaginationControls(totalPages, totalItems) {
    if (totalPages <= 1) return;
    
    // Remove existing pagination controls if they exist
    const existingPagination = gridEl.parentNode.querySelector('.pagination-container');
    if (existingPagination) {
        existingPagination.remove();
    }
    
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container flex justify-center items-center gap-2 mt-6';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '←';
    prevButton.className = `px-3 py-1 rounded border border-emerald-400/30 hover:border-emerald-400 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`;
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderGrid();
        }
    });
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'text-sm opacity-70';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = '→';
    nextButton.className = `px-3 py-1 rounded border border-emerald-400/30 hover:border-emerald-400 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`;
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderGrid();
        }
    });
    
    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextButton);
    
    gridEl.parentNode.appendChild(paginationContainer);
}

function handleSearch(event) {
    const searchTerm = event.target.value;
    const filteredArtworks = filterArtworks(searchTerm);
    currentPage = 1; // Reset to first page when searching
    renderGrid(filteredArtworks);
}
