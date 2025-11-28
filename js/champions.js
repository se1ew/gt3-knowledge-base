(function () {
    const state = {
        champions: [],
        grouped: new Map(),
        activeSeries: 'all',
        loading: false,
        saving: false,
        editingChampion: null,
    };

    function ready() {
        if (document.readyState === 'loading') {
            return new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        return Promise.resolve();
    }

    Promise.all([
        ready(),
        window.GT3 && window.GT3.partialsReady ? window.GT3.partialsReady.catch(() => ({})) : Promise.resolve({})
    ]).then(initChampionsPage);

    function initChampionsPage() {
        const api = window.GT3 && window.GT3.api;
        const auth = window.GT3 && window.GT3.auth;

        if (!api || !auth) {
            console.error('[champions.js] API или AuthManager недоступны');
            return;
        }

        const adminControls = document.getElementById('admin-controls');
        const seriesTabs = document.querySelectorAll('.series-tab');
        const timeline = document.getElementById('champions-timeline');
        const addChampionBtn = document.getElementById('add-champion-btn');
        const formModal = document.getElementById('champion-form-modal');
        const form = document.getElementById('champion-form');
        const formTitle = document.getElementById('champion-form-title');
        const formClose = document.getElementById('champion-form-close');
        const formCancel = document.getElementById('champion-form-cancel');
        const detailModal = document.getElementById('champion-detail-modal');
        const detailClose = document.getElementById('champion-detail-close');
        const detailBody = document.getElementById('champion-detail-body');

        if (!timeline || !formModal || !form) {
            console.warn('[champions.js] Не найдены обязательные элементы DOM');
            return;
        }

        function parseDrivers(value) {
            if (!value) {
                return [];
            }
            if (Array.isArray(value)) {
                return value;
            }
            return String(value)
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);
        }

        function parseStats(raw) {
            const stats = typeof raw === 'string' ? safeJsonParse(raw, {}) : (raw || {});
            return {
                wins: Number(stats.wins ?? 0),
                podiums: Number(stats.podiums ?? 0),
                points: Number(stats.points ?? 0),
            };
        }

        function safeJsonParse(value, fallback) {
            if (!value) {
                return fallback;
            }
            try {
                return JSON.parse(value);
            } catch (error) {
                return fallback;
            }
        }

        function mapChampion(raw) {
            if (!raw) {
                return null;
            }
            return {
                id: raw.id,
                year: Number(raw.year) || 0,
                series: (raw.series || 'unknown').toLowerCase(),
                team_name: raw.team_name || 'Без названия',
                drivers: parseDrivers(raw.drivers),
                car: raw.car || '—',
                image_url: raw.image_url || '',
                stats: parseStats(raw.stats),
                description: raw.description || '',
                created_at: raw.created_at,
                updated_at: raw.updated_at,
            };
        }

        function buildImagePath(champion) {
            if (!champion.image_url) {
                return 'images/team-placeholder.svg';
            }
            return champion.image_url.startsWith('http') ? champion.image_url : champion.image_url.replace(/^\/?/, '');
        }

        function groupByYear(champions) {
            const grouped = new Map();
            champions.forEach((champion) => {
                const year = champion.year || 0;
                if (!grouped.has(year)) {
                    grouped.set(year, []);
                }
                grouped.get(year).push(champion);
            });
            return new Map([...grouped.entries()].sort((a, b) => b[0] - a[0]));
        }

        function renderTimeline() {
            const filtered = state.activeSeries === 'all'
                ? state.champions.slice()
                : state.champions.filter(champion => champion.series === state.activeSeries);

            if (!filtered.length) {
                timeline.innerHTML = '<p style="text-align:center;padding:2rem;color:rgba(255,255,255,0.6);">Нет чемпионов для выбранной серии</p>';
                return;
            }

            state.grouped = groupByYear(filtered);

            const fragment = document.createDocumentFragment();

            state.grouped.forEach((entries, year) => {
                const yearHeading = document.createElement('div');
                yearHeading.className = 'timeline-year';
                yearHeading.innerHTML = `<span>${year}</span>`;
                fragment.appendChild(yearHeading);

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'timeline-items';

                entries.forEach((champion) => {
                    const item = document.createElement('div');
                    item.className = 'timeline-item';
                    item.dataset.series = champion.series;
                    item.innerHTML = buildChampionCard(champion);

                    const detailButton = item.querySelector('.champion-detail-btn');
                    if (detailButton) {
                        detailButton.addEventListener('click', () => openDetailModal(champion));
                    }

                    if (auth.isAdmin()) {
                        const actions = document.createElement('div');
                        actions.className = 'modal-admin-actions';
                        actions.innerHTML = `
                            <button class="btn-admin" data-action="edit">Редактировать</button>
                            <button class="btn-admin secondary" data-action="delete">Удалить</button>`;
                        item.querySelector('.champion-card').appendChild(actions);

                        actions.querySelector('[data-action="edit"]').addEventListener('click', () => openChampionForm(champion));
                        actions.querySelector('[data-action="delete"]').addEventListener('click', () => deleteChampion(champion));
                    }

                    itemsContainer.appendChild(item);
                });

                fragment.appendChild(itemsContainer);
            });

            timeline.innerHTML = '';
            timeline.appendChild(fragment);
            animateCards();
        }

        function buildChampionCard(champion) {
            const drivers = champion.drivers.length ? champion.drivers.join(', ') : '—';
            const stats = champion.stats || { wins: 0, podiums: 0, points: 0 };
            return `
                <article class="champion-card">
                    <div class="champion-header">
                        <img src="${buildImagePath(champion)}" alt="${champion.team_name}" class="champion-avatar" onerror="this.src='images/team-placeholder.svg'">
                        <div class="champion-info">
                            <h3>${champion.team_name}</h3>
                            <div class="champion-series">${seriesName(champion.series)}</div>
                        </div>
                    </div>
                    <div class="champion-details">
                        <div class="detail-item">
                            <span class="detail-label">Пилоты</span>
                            <span class="detail-value">${drivers}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Автомобиль</span>
                            <span class="detail-value">${champion.car}</span>
                        </div>
                    </div>
                    <div class="champion-stats">
                        <div class="stat">
                            <span class="stat-number">${stats.wins}</span>
                            <span class="stat-label">Побед</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${stats.podiums}</span>
                            <span class="stat-label">Подиумов</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${stats.points}</span>
                            <span class="stat-label">Очков</span>
                        </div>
                    </div>
                    <div class="champion-card-footer">
                        ${champion.description
                            ? `<p class="champion-description">${champion.description}</p>`
                            : ''}
                        <button class="btn-outline champion-detail-btn" data-id="${champion.id}" type="button">Подробнее</button>
                    </div>
                </article>`;
        }

        function buildDetailModalContent(champion) {
            const stats = champion.stats || { wins: 0, podiums: 0, points: 0 };
            const driversList = champion.drivers.length
                ? champion.drivers.map(driver => `<li>${driver}</li>`).join('')
                : '<li>—</li>';

            return `
                <div class="champion-detail-header">
                    <img src="${buildImagePath(champion)}" alt="${champion.team_name}" onerror="this.src='images/team-placeholder.svg'">
                    <div>
                        <h3>${champion.team_name}</h3>
                        <p>${seriesName(champion.series)} • ${champion.year}</p>
                    </div>
                </div>
                <div class="champion-detail-grid">
                    <section>
                        <h4>Пилоты</h4>
                        <ul class="champion-driver-list">${driversList}</ul>
                    </section>
                    <section>
                        <h4>Автомобиль</h4>
                        <p>${champion.car}</p>
                    </section>
                    <section>
                        <h4>Статистика сезона</h4>
                        <div class="champion-detail-stats">
                            <div><span>${stats.wins}</span><small>Побед</small></div>
                            <div><span>${stats.podiums}</span><small>Подиумов</small></div>
                            <div><span>${stats.points}</span><small>Очков</small></div>
                        </div>
                    </section>
                </div>
                ${champion.description
                    ? `<section class="champion-detail-description">
                        <h4>Обзор сезона</h4>
                        <p>${champion.description}</p>
                    </section>`
                    : ''}
            `;
        }

        function openDetailModal(champion) {
            if (!detailModal || !detailBody) {
                return;
            }
            detailBody.innerHTML = buildDetailModalContent(champion);
            detailModal.classList.add('active');
            detailModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeDetailModal() {
            if (!detailModal) {
                return;
            }
            detailModal.classList.remove('active');
            detailModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        function seriesName(code) {
            switch (code) {
                case 'gtwc':
                    return 'GT World Challenge';
                case 'imsa':
                    return 'IMSA';
                case 'dtm':
                    return 'DTM';
                case 'nls':
                    return 'Nürburgring';
                default:
                    return code;
            }
        }

        function animateCards() {
            const cards = document.querySelectorAll('.champion-card');
            if (!cards.length) {
                return;
            }

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, { threshold: 0.1 });

            cards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                observer.observe(card);
            });
        }

        function updateSeriesTabs(activeSeries) {
            seriesTabs.forEach(tab => {
                const isActive = tab.dataset.series === activeSeries;
                tab.classList.toggle('active', isActive);
            });
        }

        function bindSeriesTabs() {
            if (!seriesTabs.length) {
                return;
            }
            seriesTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const series = tab.dataset.series || 'all';
                    state.activeSeries = series.toLowerCase();
                    updateSeriesTabs(state.activeSeries);
                    renderTimeline();
                });
            });
        }

        function openChampionForm(champion = null) {
            state.editingChampion = champion;
            form.reset();

            if (champion) {
                formTitle.textContent = 'Редактировать чемпиона';
                form.querySelector('[name="year"]').value = champion.year;
                form.querySelector('[name="series"]').value = champion.series;
                form.querySelector('[name="team_name"]').value = champion.team_name;
                form.querySelector('[name="car"]').value = champion.car;
                form.querySelector('[name="image"]').value = champion.image_url;
                form.querySelector('[name="drivers"]').value = champion.drivers.join('\n');
                form.querySelector('[name="wins"]').value = champion.stats.wins;
                form.querySelector('[name="podiums"]').value = champion.stats.podiums;
                form.querySelector('[name="points"]').value = champion.stats.points;
                form.querySelector('[name="description"]').value = champion.description;
            } else {
                formTitle.textContent = 'Добавить чемпиона';
                const defaultSeriesTab = document.querySelector('.series-tab.active');
                if (defaultSeriesTab) {
                    form.querySelector('[name="series"]').value = defaultSeriesTab.dataset.series;
                }
                const latestYear = state.champions.length ? Math.max(...state.champions.map(ch => ch.year)) : new Date().getFullYear();
                form.querySelector('[name="year"]').value = latestYear;
            }

            formModal.classList.add('active');
            formModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeChampionForm() {
            formModal.classList.remove('active');
            formModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            state.editingChampion = null;
        }

        function collectFormPayload() {
            const formData = new FormData(form);

            const drivers = parseDrivers(formData.get('drivers'));
            const stats = {
                wins: Number(formData.get('wins')) || 0,
                podiums: Number(formData.get('podiums')) || 0,
                points: Number(formData.get('points')) || 0,
            };

            return {
                year: Number(formData.get('year')) || new Date().getFullYear(),
                series: (formData.get('series') || 'gtwc').toLowerCase(),
                team_name: formData.get('team_name') || '',
                car: formData.get('car') || '',
                image_url: formData.get('image') ? String(formData.get('image')).trim() : null,
                drivers,
                stats,
                description: formData.get('description') || '',
            };
        }

        async function saveChampion(event) {
            event.preventDefault();
            if (state.saving) {
                return;
            }

            const payload = collectFormPayload();

            try {
                state.saving = true;
                if (state.editingChampion) {
                    const updated = await api.put(`champions/${state.editingChampion.id}`, payload);
                    const mapped = mapChampion(updated);
                    if (mapped) {
                        state.champions = state.champions.map(champion => champion.id === mapped.id ? mapped : champion);
                    }
                } else {
                    const created = await api.post('champions', payload);
                    const mapped = mapChampion(created);
                    if (mapped) {
                        state.champions.push(mapped);
                    }
                }
                closeChampionForm();
                renderTimeline();
            } catch (error) {
                console.error('[champions.js] Не удалось сохранить чемпиона:', error);
                alert(error.message || 'Ошибка сохранения чемпиона');
            } finally {
                state.saving = false;
            }
        }

        async function deleteChampion(champion) {
            if (!champion) {
                return;
            }
            if (!confirm(`Удалить запись о чемпионе «${champion.team_name} (${champion.year})»?`)) {
                return;
            }

            try {
                await api.delete(`champions/${champion.id}`);
                state.champions = state.champions.filter(item => item.id !== champion.id);
                renderTimeline();
            } catch (error) {
                console.error('[champions.js] Не удалось удалить чемпиона:', error);
                alert(error.message || 'Ошибка удаления чемпиона');
            }
        }

        async function loadChampions() {
            state.loading = true;
            try {
                const data = await api.get('champions');
                if (Array.isArray(data)) {
                    state.champions = data.map(mapChampion).filter(Boolean).sort((a, b) => b.year - a.year);
                    renderTimeline();
                }
            } catch (error) {
                console.error('[champions.js] Не удалось загрузить чемпионов:', error);
                timeline.innerHTML = '<p style="text-align:center;padding:2rem;color:rgba(255,255,255,0.6);">Ошибка загрузки данных. Попробуйте позже.</p>';
            } finally {
                state.loading = false;
            }
        }

        function updateAdminControls() {
            if (!adminControls) {
                return;
            }
            if (auth.isAdmin()) {
                adminControls.classList.add('active');
            } else {
                adminControls.classList.remove('active');
            }
            renderTimeline();
        }

        function bindFormEvents() {
            form.addEventListener('submit', saveChampion);
            formClose.addEventListener('click', closeChampionForm);
            formCancel.addEventListener('click', closeChampionForm);
            formModal.addEventListener('click', (event) => {
                if (event.target === formModal) {
                    closeChampionForm();
                }
            });
            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') {
                    return;
                }
                if (formModal.classList.contains('active')) {
                    closeChampionForm();
                }
                if (detailModal && detailModal.classList.contains('active')) {
                    closeDetailModal();
                }
            });

            if (detailClose && detailModal) {
                detailClose.addEventListener('click', closeDetailModal);
                detailModal.addEventListener('click', (event) => {
                    if (event.target === detailModal) {
                        closeDetailModal();
                    }
                });
            }
        }

        function bindAdminButton() {
            if (!addChampionBtn) {
                return;
            }
            addChampionBtn.addEventListener('click', () => openChampionForm());
        }

        function subscribeAuth() {
            if (typeof auth.onChange === 'function') {
                auth.onChange(() => {
                    updateAdminControls();
                });
            }
            updateAdminControls();
        }

        bindSeriesTabs();
        bindFormEvents();
        bindAdminButton();
        subscribeAuth();
        loadChampions();

        window.GT3 = window.GT3 || {};
        window.GT3.champions = {
            reload: loadChampions,
            getAll() {
                return state.champions.slice();
            },
        };
    }
})();
