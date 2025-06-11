// --- Game State ---
let isTyping = false;
let typingInterval;
let gameState = {};

// --- DOM Elements ---
const storyTextElement = document.getElementById('story-text');
const choicesContainer = document.getElementById('choices-container');
const loadingIndicator = document.getElementById('loading-indicator');
const statsContainer = document.getElementById('stats-container');
const inventoryContainer = document.getElementById('inventory-container');
const achievementsContainer = document.getElementById('achievements-container');
const saveGameButton = document.getElementById('save-game');
const loadGameButton = document.getElementById('load-game');
const restartGameButton = document.getElementById('restart-game');
const modalElement = document.getElementById('modal');
const modalContentElement = document.getElementById('modal-content');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 'gameData' is available here because it's defined in index.html before this script runs.
    loadGame(); // Load game on start
    
    saveGameButton.addEventListener('click', saveGame);
    loadGameButton.addEventListener('click', loadGame);
    restartGameButton.addEventListener('click', () => {
        showModal("Mula Semula?", "Adakah anda pasti mahu memulakan semula permainan? Semua kemajuan akan hilang.", "confirm_restart");
    });
});

// --- Game Logic ---
function getDefaultGameState() {
    return {
        currentScene: 'intro',
        stats: { daulat: 10, kebijaksanaan: 10, kesetiaan: 10, kekuatan: 10 },
        inventory: ['Surat Pelantikan', 'Keris Pusaka'],
        achievements: [],
        unlockedStates: ['perlis'],
        visitedStates: []
    };
}

function saveGame() {
    try {
        localStorage.setItem('legendaDaulatState', JSON.stringify(gameState));
        showModal("Permainan Disimpan", "Kemajuan anda telah disimpan dalam pelayar ini.", "info");
    } catch (error) {
        console.error("Error saving to localStorage:", error);
        showModal("Ralat", "Tidak dapat menyimpan permainan. Storan mungkin penuh.", "error");
    }
}

function loadGame() {
    try {
        const savedState = localStorage.getItem('legendaDaulatState');
        if (savedState) {
            gameState = JSON.parse(savedState);
            showModal("Permainan Dimuat", "Selamat kembali! Permainan anda telah dimuatkan.", "info");
        } else {
            gameState = getDefaultGameState();
        }
    } catch (error) {
         console.error("Error loading from localStorage:", error);
         gameState = getDefaultGameState();
    }
    renderAll();
}

function handleChoice(choice) {
    if (isTyping) return;
    
    if (choice.action === 'restart') {
        gameState = getDefaultGameState();
        saveGame(); // Save the fresh state
        renderAll();
        return;
    }

    const currentSceneData = gameData.scenarios[gameState.currentScene];
    
    if (choice.stats) {
        Object.entries(choice.stats).forEach(([stat, value]) => {
            const oldValue = gameState.stats[stat];
            const newValue = Math.max(0, Math.min(100, oldValue + value));
            gameState.stats[stat] = newValue;
            const statElement = document.getElementById(`stat-${stat}`);
            if(statElement) {
                const changeElement = document.createElement('div');
                changeElement.textContent = `${value > 0 ? '+' : ''}${value}`;
                changeElement.className = `stat-change font-bold ${value > 0 ? 'text-green-500' : 'text-red-500'}`;
                statElement.parentElement.style.position = 'relative';
                statElement.parentElement.appendChild(changeElement);
                setTimeout(() => changeElement.remove(), 1000);
            }
        });
    }

    if (currentSceneData.achievement && !gameState.achievements.includes(currentSceneData.achievement)) {
        gameState.achievements.push(currentSceneData.achievement);
        showModal("Pencapaian Diperoleh!", `Anda telah mendapat: ${currentSceneData.achievement}`, "trophy");
    }

    if (currentSceneData.unlocks && !gameState.unlockedStates.includes(currentSceneData.unlocks)) {
        gameState.unlockedStates.push(currentSceneData.unlocks);
         showModal("Negeri Dibuka!", `Anda kini boleh mengembara ke: ${gameData.states[currentSceneData.unlocks].name}`, "map");
    }
    
    if (choice.action && choice.action.startsWith('travel_')) {
        const stateKey = choice.action.replace('travel_', '');
        if (!gameState.visitedStates.includes(stateKey)) {
            gameState.visitedStates.push(stateKey);
        }
    }

    gameState.currentScene = choice.action;
    renderAll();
}

// --- Gemini API Integration ---
async function callGemini(prompt) {
    showModal("Penasihat sedang berfikir...", "Sila tunggu sebentar...", "loading");
    const apiKey = "AIzaSyBKiomCluWdEckgj7Le75x7gTU6FtPfdfM";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("API Error Body:", errorBody);
            throw new Error(`API call failed with status: ${response.status}. Check console for details.`);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
             console.error("Unexpected API response structure:", result);
            if (result.promptFeedback && result.promptFeedback.blockReason) {
                 return `Maaf, permintaan anda disekat kerana: ${result.promptFeedback.blockReason}. Sila ubah permintaan anda.`;
            }
            return "Maaf, penasihat tidak dapat memberikan nasihat pada masa ini kerana masalah teknikal.";
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return `Maaf, terdapat ralat semasa menghubungi penasihat istana. ${error.message}`;
    }
}

async function handleGeminiAdvice() {
    const scene = gameData.scenarios[gameState.currentScene];
    const statsString = Object.entries(gameState.stats).map(([key, value]) => `${key}: ${value}`).join(', ');
    const prompt = `Anda adalah seorang Penasihat Istana yang bijaksana di Tanah Melayu pada abad ke-15. Seorang pembesar muda datang meminta nasihat.
    
    Situasi semasa: "${scene.text}"

    Status pembesar muda tersebut adalah: ${statsString}.

    Berikan nasihat yang ringkas, padat, dan bertemakan klasik (tidak lebih daripada 3 ayat) tentang tindakan yang paling bijak untuk diambil, dengan mengambil kira statusnya. Jangan beritahu secara terus pilihan mana yang perlu diambil, tetapi berikan kiasan atau panduan.`;
    
    const advice = await callGemini(prompt);
    showModal("Nasihat Penasihat Istana", advice, "advice");
}

async function handleGeminiDecree() {
    const scene = gameData.scenarios[gameState.currentScene];
     const prompt = `Anda adalah seorang jurutulis diraja yang mahir di istana Melayu abad ke-15. Atas arahan pembesar, tuliskan satu Titah Diraja yang ringkas dan puitis (dalam 3-4 ayat) untuk diumumkan kepada rakyat.
    
    Peristiwa yang perlu diumumkan adalah: "${scene.text}"
    
    Gunakan bahasa Melayu klasik yang indah dan agung. Mulakan dengan "Dengan nama Raja yang memerintah...".`;

    const decree = await callGemini(prompt);
    showModal("Draf Titah Diraja", decree, "decree");
}

// --- Render Functions ---
function renderAll() {
    if (!gameState || !gameState.currentScene) {
        gameState = getDefaultGameState();
    }
    renderScene();
    renderStats();
    renderInventory();
    renderAchievements();
}

function renderScene() {
    const scene = gameData.scenarios[gameState.currentScene];
    if (!scene) {
        console.error(`Scene not found: ${gameState.currentScene}`);
        gameState.currentScene = 'intro';
    }
    typeText(gameData.scenarios[gameState.currentScene].text, () => renderChoices(gameData.scenarios[gameState.currentScene].choices || []));
}

function renderStats() {
     statsContainer.innerHTML = `
        ${Object.entries(gameState.stats).map(([key, value]) => renderStatBar(key, value)).join('')}
    `;
}

function renderStatBar(label, value) {
    const icons = { daulat: '👑', kebijaksanaan: '📚', kesetiaan: '💖', kekuatan: '⚔️' };
    const colors = { daulat: 'bg-yellow-500', kebijaksanaan: 'bg-blue-500', kesetiaan: 'bg-red-500', kekuatan: 'bg-green-500' };
    return `
        <div id="stat-${label}" class="mb-3">
            <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium capitalize">${icons[label]} ${label}</span>
                <span class="text-sm font-bold">${value}/100</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="${colors[label]} h-2.5 rounded-full transition-all duration-500" style="width: ${value}%;"></div>
            </div>
        </div>
    `;
}

function renderInventory() {
     inventoryContainer.innerHTML = `
        <h3 class="font-bold text-lg mb-3 flex items-center text-gray-800"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2 text-gray-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path></svg>Inventori</h3>
        <div class="space-y-2">
            ${gameState.inventory.length ? gameState.inventory.map(item => `<div class="bg-gray-100 p-2 rounded-md text-sm text-gray-700">${item}</div>`).join('') : '<p class="text-sm text-gray-500">Kosong</p>'}
        </div>
    `;
}

function renderAchievements() {
    achievementsContainer.innerHTML = `
        <h3 class="font-bold text-lg mb-3 flex items-center text-gray-800"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2 text-yellow-600"><path d="M14.24 14.24a2 2 0 1 1-3.313-3.313L19 4 22 7Z"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path></svg>Pencapaian</h3>
        <div class="space-y-2">
            ${gameState.achievements.length ? gameState.achievements.map(a => `<div class="bg-yellow-100 p-2 rounded-md text-sm text-yellow-800 font-medium">${a}</div>`).join('') : '<p class="text-sm text-gray-500">Tiada lagi.</p>'}
        </div>
    `;
}

function renderChoices(choices) {
    choicesContainer.innerHTML = '<h3 class="font-bold text-lg text-gray-800 mb-4">Pilihan Anda:</h3>';
    const currentSceneData = gameData.scenarios[gameState.currentScene];

    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = `w-full text-left p-4 bg-gradient-to-r from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200 rounded-lg border border-amber-300 transition-all duration-200 hover:shadow-md group`;
        button.onclick = () => handleChoice(choice);
        button.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-medium text-amber-900 group-hover:text-amber-900">${choice.text}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>`;
        choicesContainer.appendChild(button);
    });
    
    if (currentSceneData.hasGeminiAdvice) {
        const adviceButton = document.createElement('button');
        adviceButton.className = 'w-full text-left p-4 mt-4 bg-gradient-to-r from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 rounded-lg border border-purple-300 transition-all duration-200 hover:shadow-md group';
        adviceButton.onclick = handleGeminiAdvice;
        adviceButton.innerHTML = `<div class="flex items-center justify-between"><span class="font-medium text-purple-900">✨ Minta Nasihat Penasihat Istana</span><span class="text-lg">🤔</span></div>`;
        choicesContainer.appendChild(adviceButton);
    }
    
    if (currentSceneData.canDraftDecree) {
        const decreeButton = document.createElement('button');
        decreeButton.className = 'w-full text-left p-4 mt-4 bg-gradient-to-r from-teal-100 to-cyan-100 hover:from-teal-200 hover:to-cyan-200 rounded-lg border border-teal-300 transition-all duration-200 hover:shadow-md group';
        decreeButton.onclick = handleGeminiDecree;
        decreeButton.innerHTML = `<div class="flex items-center justify-between"><span class="font-medium text-teal-900">✨ Rangka Titah Diraja</span><span class="text-lg">📜</span></div>`;
        choicesContainer.appendChild(decreeButton);
    }
}

// --- UI Effects ---
function typeText(text, callback) {
    isTyping = true;
    storyTextElement.innerHTML = '';
    choicesContainer.innerHTML = '';
    loadingIndicator.classList.remove('hidden');
    let i = 0;
    if (typingInterval) clearInterval(typingInterval);
    typingInterval = setInterval(() => {
        if (i < text.length) {
            storyTextElement.innerHTML = text.slice(0, i+1) + '<span class="animate-pulse">|</span>';
            i++;
        } else {
            clearInterval(typingInterval);
            storyTextElement.innerHTML = text;
            isTyping = false;
            loadingIndicator.classList.add('hidden');
            if (callback) callback();
        }
    }, 30);
}

function showModal(title, message, iconType = "info") {
    const icons = {
        trophy: '🏆', map: '🗺️', info: 'ℹ️', error: '❌', confirm_restart: '🔄',
        advice: '🤔', decree: '📜', loading: '⏳'
    };
    
    let buttons = `<button id="modal-close" class="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">Tutup</button>`;
    if (iconType === 'confirm_restart') {
        buttons = `
            <button id="confirm-restart-btn" class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 mr-2">Ya, Mula Semula</button>
            <button id="modal-close" class="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">Batal</button>
        `;
    } else if (iconType === 'loading') {
        buttons = ''; // No button for loading modal
    }

    modalContentElement.innerHTML = `
        <div class="text-5xl mb-4">${icons[iconType]}</div>
        <h2 class="text-2xl font-bold mb-2 text-gray-800">${title}</h2>
        <p class="text-gray-600 mb-6 whitespace-pre-wrap">${message}</p>
        <div class="flex justify-center">${buttons}</div>
    `;
    modalElement.classList.remove('hidden');
    
    const closeButton = document.getElementById('modal-close');
    if (closeButton) {
        closeButton.onclick = () => modalElement.classList.add('hidden');
    }

    if (iconType === 'confirm_restart') {
        document.getElementById('confirm-restart-btn').onclick = () => {
            modalElement.classList.add('hidden');
            handleChoice({ action: 'restart' });
        };
    }
}
