(function () {
    const state = {
        allPilots: [],
        activeSeries: 'all',
        editingPilot: null,
        loading: false,
        saving: false,
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
    ]).then(initPilotsPage);

    function initPilotsPage() {
        const api = window.GT3 && window.GT3.api;
        const auth = window.GT3 && window.GT3.auth;

        if (!api || !auth) {
            console.error('[pilots.js] API или AuthManager недоступны');
            return;
        }

        const filters = document.querySelectorAll('.filter-btn');
        const grid = document.getElementById('pilots-grid');
        const adminControls = document.getElementById('admin-controls');
        const addPilotBtn = document.getElementById('add-pilot-btn');
        const formModal = document.getElementById('pilot-form-modal');
        const form = document.getElementById('pilot-form');
        const formTitle = document.getElementById('pilot-form-title');
        const formClose = document.getElementById('pilot-form-close');
        const formCancel = document.getElementById('pilot-form-cancel');
        const detailModal = document.getElementById('pilot-detail-modal');
        const detailClose = document.getElementById('pilot-detail-close');
        const detailBody = document.getElementById('pilot-detail-body');

        if (!grid || !formModal || !form) {
            console.warn('[pilots.js] Не найдены обязательные элементы DOM');
            return;
        }

        function buildImagePath(pilot) {
            const candidate = pilot.image_url || pilot.image;
            if (!candidate) {
                return 'images/pilot-placeholder.jpg';
            }
            return candidate.startsWith('http') ? candidate : candidate.replace(/^\/?/, '');
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

        function parseCommaList(value, transform = x => x) {
            if (!value) {
                return [];
            }
            const list = Array.isArray(value) ? value : String(value).split(',');
            return list
                .map(item => transform(String(item).trim()))
                .filter(Boolean);
        }

        function parseLines(value) {
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

        function numberOrNull(value) {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const number = Number(value);
            return Number.isNaN(number) ? null : number;
        }

        function mapPilot(raw, index = 0) {
            if (!raw) {
                return null;
            }

            const statsRaw = typeof raw.stats === 'string' ? safeJsonParse(raw.stats, {}) : (raw.stats || {});
            const championships = parseLines(raw.championships);
            const series = parseCommaList(raw.series, value => value.toLowerCase());
            const tags = parseCommaList(raw.tags);

            return {
                id: raw.id ?? index,
                name: raw.name || 'Без имени',
                nationality: raw.nationality || '—',
                flag: raw.flag || '🏁',
                team: raw.team || '—',
                car: raw.car || '—',
                championships,
                series,
                tags,
                image_url: raw.image_url || raw.image || '',
                stats: {
                    wins: Number(statsRaw.wins ?? 0),
                    podiums: Number(statsRaw.podiums ?? 0),
                    titles: Number(statsRaw.titles ?? 0),
                },
            };
        }

        function renderPilots() {
            grid.innerHTML = '';

            const list = state.activeSeries === 'all'
                ? state.allPilots.slice()
                : state.allPilots.filter(pilot => pilot.series.includes(state.activeSeries));

            if (!list.length) {
                grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.6);padding:2rem;">Пилоты не найдены для выбранной серии</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            list.forEach((pilot) => {
                const badge = pilot.championships[0] || 'GT3 Driver';
                const championshipsHtml = pilot.championships.length
                    ? pilot.championships.join('<br>')
                    : '—';
                const tagsHtml = pilot.tags.length
                    ? pilot.tags.map(tag => `<span class="pilot-tag">${tag}</span>`).join('')
                    : '<span class="pilot-tag">GT3</span>';

                const card = document.createElement('article');
                card.className = 'pilot-card';
                card.innerHTML = `
                    <div class="pilot-header">
                        <img src="${buildImagePath(pilot)}" alt="${pilot.name}" class="pilot-photo" onerror="this.src='images/pilot-placeholder.jpg'">
                        <span class="pilot-badge">${badge}</span>
                        <span class="pilot-flag"><span>${pilot.flag}</span>${pilot.nationality}</span>
                    </div>
                    <div class="pilot-content">
                        <div>
                            <h3 class="pilot-name">${pilot.name}</h3>
                            <div class="pilot-team">${pilot.team}</div>
                        </div>
                        <div class="pilot-meta">
                            <div class="meta-item">
                                <span class="meta-label">Автомобиль</span>
                                <span class="meta-value">${pilot.car}</span>
                            </div>
                            <div class="meta-item">
                                <span class="meta-label">Главные титулы</span>
                                <span class="meta-value">${championshipsHtml}</span>
                            </div>
                        </div>
                        <div class="pilot-statistics">
                            <div class="stat">
                                <div class="stat-number">${pilot.stats.wins}</div>
                                <div class="stat-label">Побед</div>
                            </div>
                            <div class="stat">
                                <div class="stat-number">${pilot.stats.podiums}</div>
                                <div class="stat-label">Подиумов</div>
                            </div>
                            <div class="stat">
                                <div class="stat-number">${pilot.stats.titles}</div>
                                <div class="stat-label">Титулов</div>
                            </div>
                        </div>
                        <div class="pilot-tags">
                            ${tagsHtml}
                        </div>
                        <div class="pilot-card-footer">
                            <button class="btn-outline pilot-detail-btn" data-id="${pilot.id}" type="button">Подробнее</button>
                        </div>
                    </div>`;

                const detailButton = card.querySelector('.pilot-detail-btn');
                if (detailButton) {
                    detailButton.addEventListener('click', () => openDetailModal(pilot));
                }

                if (auth.isAdmin()) {
                    const adminActions = document.createElement('div');
                    adminActions.className = 'pilot-admin-actions';
                    adminActions.innerHTML = `
                        <button type="button" class="btn-admin" data-action="edit">Редактировать</button>
                        <button type="button" class="btn-admin secondary" data-action="delete">Удалить</button>`;
                    card.querySelector('.pilot-content').appendChild(adminActions);

                    adminActions.querySelector('[data-action="edit"]').addEventListener('click', () => {
                        openPilotForm(pilot);
                    });
                    adminActions.querySelector('[data-action="delete"]').addEventListener('click', () => {
                        deletePilot(pilot);
                    });
                }

                fragment.appendChild(card);
            });

            grid.appendChild(fragment);
        }

        function buildDetailModalContent(pilot) {
            const championshipsList = pilot.championships.length
                ? pilot.championships.map(title => `<li>${title}</li>`).join('')
                : '<li>—</li>';
            const seriesList = pilot.series.length
                ? pilot.series.map(code => `<span class="pilot-series-chip">${code.toUpperCase()}</span>`).join('')
                : '<span class="pilot-series-chip">GT3</span>';
            const tagsList = pilot.tags.length
                ? pilot.tags.map(tag => `<span class="pilot-detail-tag">${tag}</span>`).join('')
                : '<span class="pilot-detail-tag">GT3 Driver</span>';

            return `
                <div class="pilot-detail-header">
                    <img src="${buildImagePath(pilot)}" alt="${pilot.name}" onerror="this.src='images/pilot-placeholder.jpg'">
                    <div>
                        <h3>${pilot.name}</h3>
                        <p>${pilot.team}</p>
                        <p>${pilot.flag} ${pilot.nationality}</p>
                        <div class="pilot-detail-series">${seriesList}</div>
                    </div>
                </div>
                <div class="pilot-detail-grid">
                    <section>
                        <h4>Автомобиль</h4>
                        <p>${pilot.car}</p>
                    </section>
                    <section>
                        <h4>Главные титулы</h4>
                        <ul class="pilot-championships">${championshipsList}</ul>
                    </section>
                    <section>
                        <h4>Статистика</h4>
                        <div class="pilot-detail-stats">
                            <div><span>${pilot.stats.wins}</span><small>Побед</small></div>
                            <div><span>${pilot.stats.podiums}</span><small>Подиумов</small></div>
                            <div><span>${pilot.stats.titles}</span><small>Титулов</small></div>
                        </div>
                    </section>
                    <section>
                        <h4>Теги</h4>
                        <div class="pilot-detail-tags">${tagsList}</div>
                    </section>
                </div>
            `;
        }

        function openDetailModal(pilot) {
            if (!detailModal || !detailBody) {
                return;
            }
            detailBody.innerHTML = buildDetailModalContent(pilot);
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

        function updateFilterButtons() {
            if (!filters.length) {
                return;
            }
            filters.forEach(button => {
                const isActive = button.dataset.series === state.activeSeries;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        function bindFilters() {
            if (!filters.length) {
                return;
            }
            const activeButton = Array.from(filters).find(button => button.classList.contains('active'));
            state.activeSeries = (activeButton && activeButton.dataset.series) || 'all';

            filters.forEach(button => {
                button.addEventListener('click', () => {
                    state.activeSeries = (button.dataset.series || 'all').toLowerCase();
                    updateFilterButtons();
                    renderPilots();
                });
            });
        }

        function openPilotForm(pilot = null) {
            state.editingPilot = pilot;
            form.reset();

            if (pilot) {
                formTitle.textContent = 'Редактировать пилота';
                form.querySelector('[name="name"]').value = pilot.name;
                form.querySelector('[name="nationality"]').value = pilot.nationality;
                form.querySelector('[name="flag"]').value = pilot.flag;
                form.querySelector('[name="team"]').value = pilot.team;
                form.querySelector('[name="car"]').value = pilot.car;
                form.querySelector('[name="series"]').value = pilot.series.join(', ');
                form.querySelector('[name="tags"]').value = pilot.tags.join(', ');
                form.querySelector('[name="image"]').value = pilot.image_url;
                form.querySelector('[name="championships"]').value = pilot.championships.join('\n');
                form.querySelector('[name="stats_wins"]').value = pilot.stats.wins;
                form.querySelector('[name="stats_podiums"]').value = pilot.stats.podiums;
                form.querySelector('[name="stats_titles"]').value = pilot.stats.titles;
            } else {
                formTitle.textContent = 'Добавить пилота';
            }

            formModal.classList.add('active');
            formModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closePilotForm() {
            formModal.classList.remove('active');
            formModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            state.editingPilot = null;
        }

        function collectFormPayload() {
            const formData = new FormData(form);

            const championships = parseLines(formData.get('championships'));
            const series = parseCommaList(formData.get('series'), value => value.toLowerCase());
            const tags = parseCommaList(formData.get('tags'));

            const stats = {
                wins: numberOrNull(formData.get('stats_wins')) ?? 0,
                podiums: numberOrNull(formData.get('stats_podiums')) ?? 0,
                titles: numberOrNull(formData.get('stats_titles')) ?? 0,
            };

            return {
                name: formData.get('name') || '',
                nationality: formData.get('nationality') || '',
                flag: formData.get('flag') || '',
                team: formData.get('team') || '',
                car: formData.get('car') || '',
                championships,
                series,
                tags,
                stats,
                image_url: formData.get('image') ? String(formData.get('image')).trim() : null,
            };
        }

        async function savePilot(event) {
            event.preventDefault();
            if (state.saving) {
                return;
            }

            const payload = collectFormPayload();

            try {
                state.saving = true;
                if (state.editingPilot) {
                    const updated = await api.put(`pilots/${state.editingPilot.id}`, payload);
                    const mapped = mapPilot(updated, state.editingPilot.id);
                    if (mapped) {
                        state.allPilots = state.allPilots.map(pilot => pilot.id === mapped.id ? mapped : pilot);
                        state.editingPilot = mapped;
                    }
                } else {
                    const created = await api.post('pilots', payload);
                    const mapped = mapPilot(created, state.allPilots.length);
                    if (mapped) {
                        state.allPilots.unshift(mapped);
                    }
                }

                closePilotForm();
                renderPilots();
            } catch (error) {
                console.error('[pilots.js] Не удалось сохранить пилота:', error);
                alert(error.message || 'Ошибка сохранения пилота');
            } finally {
                state.saving = false;
            }
        }

        async function deletePilot(pilot) {
            if (!pilot) {
                return;
            }
            if (!confirm(`Удалить пилота «${pilot.name}»?`)) {
                return;
            }

            try {
                await api.delete(`pilots/${pilot.id}`);
                state.allPilots = state.allPilots.filter(item => item.id !== pilot.id);
                renderPilots();
            } catch (error) {
                console.error('[pilots.js] Не удалось удалить пилота:', error);
                alert(error.message || 'Ошибка удаления пилота');
            }
        }

        async function loadPilots() {
            state.loading = true;
            try {
                const data = await api.get('pilots');
                if (Array.isArray(data)) {
                    state.allPilots = data.map((pilot, index) => mapPilot(pilot, index)).filter(Boolean);
                    renderPilots();
                }
            } catch (error) {
                console.error('[pilots.js] Не удалось загрузить пилотов:', error);
                grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.6);padding:2rem;">Ошибка загрузки данных. Попробуйте позже.</p>';
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
        }

        function bindEvents() {
            bindFilters();
            updateFilterButtons();

            if (addPilotBtn) {
                addPilotBtn.addEventListener('click', () => openPilotForm());
            }

            form.addEventListener('submit', savePilot);
            formClose.addEventListener('click', closePilotForm);
            formCancel.addEventListener('click', closePilotForm);
            formModal.addEventListener('click', (event) => {
                if (event.target === formModal) {
                    closePilotForm();
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
            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') {
                    return;
                }
                if (formModal.classList.contains('active')) {
                    closePilotForm();
                }
                if (detailModal && detailModal.classList.contains('active')) {
                    closeDetailModal();
                }
            });
        }

        function subscribeAuth() {
            if (typeof auth.onChange === 'function') {
                auth.onChange(() => {
                    updateAdminControls();
                    renderPilots();
                });
            }
            updateAdminControls();
        }

        bindEvents();
        subscribeAuth();
        loadPilots();

        window.GT3 = window.GT3 || {};
        window.GT3.pilots = {
            reload: loadPilots,
            getAll() {
                return state.allPilots.slice();
            },
            filterBySeries(series) {
                const code = (series || 'all').toLowerCase();
                return code === 'all'
                    ? state.allPilots.slice()
                    : state.allPilots.filter(pilot => pilot.series.includes(code));
            },
        };
    }
})();
