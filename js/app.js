document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.error('SW Error', err));
    }

    // Lucide Icons
    lucide.createIcons();

    // I18n Dictionary
    const i18n = {
        en: {
            settings: "Settings",
            language: "Language",
            theme: "Theme",
            dark_mode: "Dark Mode",
            search_placeholder: "Search channels...",
            select_channel: "Select a channel to start streaming",
            all_channels: "All Channels",
            results_for: 'Search results for "{term}"',
            recently_played: "Recently Played",
            cat_all: "All",
            cat_favorites: "Favorites",
            cat_sports: "Sports",
            cat_news: "News",
            cat_bangla: "Bangla",
            cat_indian_bangla: "Indian Bangla",
            cat_music: "Music",
            cat_hindi: "Hindi",
            cat_documentary: "Documentary",
            cat_kids: "Kids",
            done: "Done"
        },
        bn: {
            settings: "সেটিংস",
            language: "ভাষা",
            theme: "থিম",
            dark_mode: "ডার্ক মোড",
            search_placeholder: "চ্যানেল খুঁজুন...",
            select_channel: "স্ট্রিমিং শুরু করতে একটি চ্যানেল নির্বাচন করুন",
            all_channels: "সব চ্যানেল",
            results_for: '"{term}" এর জন্য ফলাফল',
            recently_played: "সম্প্রতি দেখা",
            cat_all: "সব",
            cat_favorites: "ফেভারিট",
            cat_sports: "খেলাধুলা",
            cat_news: "খবর",
            cat_bangla: "বাংলা",
            cat_indian_bangla: "ইন্ডিয়ান বাংলা",
            cat_music: "গান",
            cat_hindi: "হিন্দি",
            cat_documentary: "ডকুমেন্টারি",
            cat_kids: "কিডস",
            done: "সম্পন্ন"
        }
    };

    let currentLang = localStorage.getItem('6tv_lang') || 'en';
    let favorites = JSON.parse(localStorage.getItem('6tv_favs')) || [];
    let recentlyPlayed = JSON.parse(localStorage.getItem('6tv_recent')) || [];

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (i18n[currentLang][key]) el.placeholder = i18n[currentLang][key];
        });
        localStorage.setItem('6tv_lang', currentLang);
        renderCategories(allChannels);
    }

    const categoryIcons = {
        'All': 'layout-grid',
        'Favorites': 'heart',
        'Sports': 'trophy',
        'News': 'newspaper',
        'Bangla': 'tv',
        'Indian Bangla': 'languages',
        'Music': 'music',
        'Hindi': 'film',
        'Documentary': 'globe',
        'Kids': 'smile'
    };

    let allChannels = [];
    let player = videojs('main-player', {
        fluid: true,
        autoplay: false,
        controls: true,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.5, 2],
        userActions: { hotkeys: true, doubleClick: true },
        controlBar: {
            children: [
                'playToggle', 'volumePanel', 'currentTimeDisplay', 'timeDivider',
                'durationDisplay', 'progressControl', 'liveDisplay', 'remainingTimeDisplay',
                'playbackRateMenuButton', 'pictureInPictureToggle', 'fullscreenToggle',
            ],
        },
    });

    // Touch/Click to Pause
    const playerContainer = document.getElementById('player-container');
    playerContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'VIDEO' || e.target.classList.contains('vjs-tech')) {
            if (player.paused()) player.play();
            else player.pause();
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        if (e.key === 'ArrowUp') player.volume(Math.min(player.volume() + 0.1, 1));
        if (e.key === 'ArrowDown') player.volume(Math.max(player.volume() - 0.1, 0));
        if (e.key === 'f' || e.key === 'F') player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen();
        if (e.key === 'm' || e.key === 'M') player.muted(!player.muted());
    });

    player.on('error', function() {
        setTimeout(() => { player.src(player.src()); player.load(); player.play(); }, 5000);
    });

    const channelsGrid = document.getElementById('channels-grid');
    const categoryList = document.getElementById('category-list');
    const searchInput = document.getElementById('search-input');
    const categoryTitle = document.getElementById('category-title');
    const nowPlayingTitle = document.getElementById('now-playing-title');
    const nowPlayingCat = document.getElementById('now-playing-cat');
    const favToggleBtn = document.getElementById('fav-toggle-btn');
    const recentSection = document.getElementById('recent-section');
    const recentGrid = document.getElementById('recent-grid');

    // Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    if (menuToggle) menuToggle.onclick = toggleSidebar;
    if (overlay) overlay.onclick = toggleSidebar;

    // Fetch Channels
    fetch('tv_channels.json')
        .then(response => response.json())
        .then(data => {
            allChannels = data.channels.filter(ch => ch.status !== 'hidden');
            updateLanguage();
            renderChannels(allChannels);
            renderRecentPlayed();

            // Auto-play the first channel to avoid "weird" empty state
            if (allChannels.length > 0) {
                playChannel(allChannels[0]);
            }
        })
        .catch(err => console.error('Error loading channels:', err));

    function renderCategories(channels) {
        const uniqueCats = [...new Set(channels.map(ch => ch.category))];
        const categories = ['All', 'Favorites', ...uniqueCats];
        categoryList.innerHTML = '';
        
        categories.forEach(cat => {
            const div = document.createElement('div');
            const isActive = categoryTitle.getAttribute('data-active-cat') === cat || (cat === 'All' && !categoryTitle.getAttribute('data-active-cat'));
            div.className = `cat-item ${isActive ? 'active' : ''}`;
            
            const iconName = categoryIcons[cat] || 'hash';
            const catLangKey = `cat_${cat.toLowerCase().replace(/ /g, '_')}`;
            const catName = i18n[currentLang][catLangKey] || cat;

            div.innerHTML = `<i data-lucide="${iconName}"></i><span>${catName}</span>`;
            
            div.onclick = () => {
                document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                categoryTitle.setAttribute('data-active-cat', cat);
                filterChannels(cat);
                if (window.innerWidth <= 768) toggleSidebar();
            };
            categoryList.appendChild(div);
        });
        lucide.createIcons();
    }

    function renderChannels(channels) {
        channelsGrid.innerHTML = '';
        if (channels.length === 0) {
            channelsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No channels found.</p>';
            return;
        }
        channels.forEach(channel => {
            const isFav = favorites.some(f => f.name === channel.name);
            const card = document.createElement('div');
            card.className = `channel-card ${allChannels.find(c => c.playing && c.name === channel.name) ? 'playing' : ''}`;
            
            card.innerHTML = `
                <div class="badge">HD</div>
                <button class="fav-card-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${channel.name}')">
                    <i data-lucide="heart"></i>
                </button>
                <div class="logo-wrapper">
                    <img src="${channel.logo}" alt="${channel.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="logo-placeholder" style="display:none;">${channel.name}</div>
                </div>
                <h4>${channel.name}</h4>
            `;
            card.onclick = () => playChannel(channel, card);
            channelsGrid.appendChild(card);
        });
        lucide.createIcons();
    }

    function filterChannels(category) {
        const catLangKey = `cat_${category.toLowerCase().replace(/ /g, '_')}`;
        const translatedCat = i18n[currentLang][catLangKey] || category;
        categoryTitle.textContent = category === 'All' ? i18n[currentLang].all_channels : translatedCat;
        
        let filtered = [];
        if (category === 'All') filtered = allChannels;
        else if (category === 'Favorites') filtered = favorites;
        else filtered = allChannels.filter(ch => ch.category === category);
        
        renderChannels(filtered);
    }

    function playChannel(channel, cardEl) {
        document.querySelectorAll('.channel-card').forEach(el => el.classList.remove('playing'));
        if (cardEl) cardEl.classList.add('playing');
        
        nowPlayingTitle.textContent = channel.name;
        nowPlayingCat.textContent = channel.category;

        player.pause();
        player.src({ src: channel.url, type: 'application/x-mpegURL' });
        player.load();
        player.play().catch(() => {});

        // Update Fav Button in Player
        updateFavButton(channel.name);

        // Save to Recently Played
        addToRecent(channel);

        // Highlight category in sidebar
        highlightCategory(channel.category);

        if (window.innerWidth <= 768) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function highlightCategory(category) {
        document.querySelectorAll('.cat-item').forEach(el => {
            if (el.textContent.includes(category) || (category === 'Favorites' && el.querySelector('[data-lucide="heart"]'))) {
                document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
            }
        });
    }

    function updateFavButton(channelName) {
        const isFav = favorites.some(f => f.name === channelName);
        favToggleBtn.classList.toggle('active', isFav);
        favToggleBtn.onclick = () => toggleFavorite(channelName);
    }

    window.toggleFavorite = function(channelName) {
        const channel = allChannels.find(c => c.name === channelName);
        const index = favorites.findIndex(f => f.name === channelName);
        if (index > -1) favorites.splice(index, 1);
        else if (channel) favorites.push(channel);
        
        localStorage.setItem('6tv_favs', JSON.stringify(favorites));
        updateFavButton(channelName);
        
        // Refresh grids
        const activeCat = categoryTitle.getAttribute('data-active-cat') || 'All';
        filterChannels(activeCat);
        renderRecentPlayed();
    };

    function addToRecent(channel) {
        recentlyPlayed = recentlyPlayed.filter(c => c.name !== channel.name);
        recentlyPlayed.unshift(channel);
        if (recentlyPlayed.length > 5) recentlyPlayed.pop();
        localStorage.setItem('6tv_recent', JSON.stringify(recentlyPlayed));
        renderRecentPlayed();
    }

    function renderRecentPlayed() {
        if (recentlyPlayed.length === 0) {
            recentSection.style.display = 'none';
            return;
        }
        recentSection.style.display = 'block';
        recentGrid.innerHTML = '';
        recentlyPlayed.forEach(channel => {
            const div = document.createElement('div');
            div.className = 'channel-card';
            div.style.minWidth = '160px';
            div.innerHTML = `
                <div class="logo-wrapper" style="height: 80px;">
                    <img src="${channel.logo}" alt="${channel.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="logo-placeholder" style="display:none; font-size: 10px;">${channel.name}</div>
                </div>
                <h4 style="font-size: 12px;">${channel.name}</h4>
            `;
            div.onclick = () => playChannel(channel, div);
            recentGrid.appendChild(div);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(term) || ch.category.toLowerCase().includes(term));
        renderChannels(filtered);
        categoryTitle.textContent = term ? i18n[currentLang].results_for.replace('{term}', term) : i18n[currentLang].all_channels;
    });

    const modal = document.getElementById('settings-modal');
    const trigger = document.getElementById('settings-trigger');
    const close = document.getElementById('close-settings');
    const saveBtn = document.getElementById('save-settings');
    const langSelect = document.getElementById('language-select');

    trigger.onclick = () => modal.classList.add('active');
    close.onclick = () => modal.classList.remove('active');
    saveBtn.onclick = () => modal.classList.remove('active');
    langSelect.value = currentLang;
    langSelect.onchange = (e) => {
        currentLang = e.target.value;
        updateLanguage();
        filterChannels(categoryTitle.getAttribute('data-active-cat') || 'All');
    };

    setInterval(() => {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);
});
