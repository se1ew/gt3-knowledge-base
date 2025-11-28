(function () {
    const state = {
        allTeams: [],
        selectedTeam: null,
        editingTeam: null,
        loading: false,
        saving: false,
    };

    const COUNTRY_LABELS = {
        germany: 'Германия',
        italy: 'Италия',
        france: 'Франция',
        uk: 'Великобритания',
        usa: 'США',
        austria: 'Австрия',
        belgium: 'Бельгия',
        canada: 'Канада',
        japan: 'Япония',
        spain: 'Испания',
        netherlands: 'Нидерланды',
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
    ]).then(initTeamsPage);

    function initTeamsPage() {
        const api = window.GT3 && window.GT3.api;
        const auth = window.GT3 && window.GT3.auth;

        if (!api || !auth) {
            console.error('[teams.js] API или AuthManager недоступны');
            return;
        }

        const teamsGrid = document.getElementById('teams-grid');
        const teamModal = document.getElementById('team-modal');
        const teamModalClose = document.getElementById('team-modal-close');
        const adminControls = document.getElementById('admin-controls');
        const addTeamBtn = document.getElementById('add-team-btn');
        const editTeamBtn = document.getElementById('edit-team-btn');
        const teamModalEdit = document.getElementById('team-modal-edit');
        const teamModalDelete = document.getElementById('team-modal-delete');
        const teamFormModal = document.getElementById('team-form-modal');
        const teamFormTitle = document.getElementById('team-form-title');
        const teamForm = document.getElementById('team-form');
        const teamFormClose = document.getElementById('team-form-close');
        const teamFormCancel = document.getElementById('team-form-cancel');

        if (!teamsGrid || !teamModal || !teamModalClose || !teamFormModal || !teamForm) {
            console.warn('[teams.js] Не найдены обязательные элементы DOM');
            return;
        }

        function getCountryName(code) {
            if (!code) {
                return '—';
            }
            const lower = String(code).toLowerCase();
            return COUNTRY_LABELS[lower] || code;
        }

        function buildImagePath(team) {
            if (!team.image_url) {
                return 'images/team-placeholder.svg';
            }
            const candidate = team.image_url;
            if (/^https?:/i.test(candidate)) {
                return candidate;
            }
            return candidate.replace(/^\/?/, '');
        }

        function mapTeam(raw, index = 0) {
            if (!raw) {
                return null;
            }

            const stats = typeof raw.stats === 'string' ? safeJsonParse(raw.stats, {}) : (raw.stats || {});
            const series = Array.isArray(raw.series) ? raw.series : parseStringArray(raw.series);
            const cars = Array.isArray(raw.cars) ? raw.cars : parseStringArray(raw.cars);
            const achievements = Array.isArray(raw.achievements)
                ? raw.achievements
                : parseAchievements(raw.achievements);

            return {
                id: raw.id ?? index,
                name: raw.name || 'Без названия',
                country: raw.country || '',
                founded: raw.founded ?? null,
                series,
                cars,
                logo: raw.logo || '',
                image_url: raw.image_url || '',
                description: raw.description || '',
                stats: {
                    races: Number(stats.races ?? 0),
                    wins: Number(stats.wins ?? 0),
                    podiums: Number(stats.podiums ?? 0),
                    titles: Number(stats.titles ?? 0),
                },
                achievements,
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

        function parseStringArray(value) {
            if (!value) {
                return [];
            }
            if (Array.isArray(value)) {
                return value;
            }
            return String(value)
                .split(',')
                .map(item => item.trim())
                .filter(Boolean);
        }

        function parseAchievements(value) {
            if (!value) {
                return [];
            }
            if (Array.isArray(value)) {
                return value;
            }

            return String(value)
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                    const [year, event, result] = line.split('|').map(part => part && part.trim());
                    return {
                        year: year ? Number(year) : null,
                        event: event || '',
                        result: result || '',
                    };
                });
        }

        function achievementsToTextarea(list) {
            if (!Array.isArray(list)) {
                return '';
            }
            return list
                .map(item => [item.year ?? '', item.event ?? '', item.result ?? ''].join(' | '))
                .join('\n');
        }

        function renderTeams(list) {
            teamsGrid.innerHTML = '';

            if (!list.length) {
                teamsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Команды не найдены</p>';
                return;
            }

            const fragment = document.createDocumentFragment();

            list.forEach((team) => {
                const card = document.createElement('div');
                card.className = 'team-card';
                card.innerHTML = `
                    <div class="team-header">
                        <div class="team-logo">${team.logo || team.name.slice(0, 2).toUpperCase()}</div>
                        <img src="${buildImagePath(team)}" alt="${team.name}" class="team-image" onerror="this.src='images/team-placeholder.svg'">
                    </div>
                    <div class="team-content">
                        <h3 class="team-title">${team.name}</h3>
                        <div class="team-country">
                            <span>🏁</span>
                            <span>${getCountryName(team.country)}</span>
                        </div>
                        <div class="team-details">
                            <div class="detail-item">
                                <span class="detail-label">Основана</span>
                                <span class="detail-value">${team.founded ?? '—'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Серии</span>
                                <span class="detail-value">${team.series.length}</span>
                            </div>
                        </div>
                        <div class="team-cars">
                            ${team.cars.map(car => `<span class="car-badge">${car}</span>`).join('')}
                        </div>
                        <div class="team-stats">
                            <div class="stat">
                                <span class="stat-number">${team.stats.wins}</span>
                                <span class="stat-label">Побед</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number">${team.stats.titles}</span>
                                <span class="stat-label">Титулов</span>
                            </div>
                        </div>
                        <div class="team-actions">
                            <button class="btn-primary view-team" type="button" data-id="${team.id}">Подробнее</button>
                        </div>
                    </div>`;
                fragment.appendChild(card);
            });

            teamsGrid.appendChild(fragment);

            teamsGrid.querySelectorAll('.view-team').forEach((button) => {
                button.addEventListener('click', () => {
                    const id = Number(button.dataset.id);
                    const team = state.allTeams.find(item => item.id === id);
                    if (team) {
                        openTeamModal(team);
                    }
                });
            });
        }

        function attachModalHandlers() {
            teamModalClose.addEventListener('click', closeTeamModal);
            teamModal.addEventListener('click', (event) => {
                if (event.target === teamModal) {
                    closeTeamModal();
                }
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && teamModal.classList.contains('active')) {
                    closeTeamModal();
                }
            });

            teamFormClose.addEventListener('click', closeTeamForm);
            teamFormCancel.addEventListener('click', closeTeamForm);
            teamFormModal.addEventListener('click', (event) => {
                if (event.target === teamFormModal) {
                    closeTeamForm();
                }
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && teamFormModal.classList.contains('active')) {
                    closeTeamForm();
                }
            });
        }

        function openTeamModal(team) {
            state.selectedTeam = team;

            document.getElementById('modal-team-title').textContent = team.name;
            document.getElementById('modal-team-name').textContent = team.name;
            const imageEl = document.getElementById('modal-team-image');
            imageEl.src = buildImagePath(team);
            imageEl.alt = team.name;
            document.getElementById('modal-team-country').textContent = getCountryName(team.country);
            document.getElementById('modal-team-description').textContent = team.description || 'Описание пока отсутствует';
            document.getElementById('modal-races').textContent = team.stats.races ?? 0;
            document.getElementById('modal-wins').textContent = team.stats.wins ?? 0;
            document.getElementById('modal-podiums').textContent = team.stats.podiums ?? 0;
            document.getElementById('modal-titles').textContent = team.stats.titles ?? 0;

            const achievementsContainer = document.getElementById('modal-achievements');
            achievementsContainer.innerHTML = team.achievements.length
                ? team.achievements.map(item => `
                        <div class="achievement-item">
                            <span>${item.year ?? '—'} — ${item.event || '—'}</span>
                            <span style="color: var(--accent-red); font-weight: 600;">${item.result || ''}</span>
                        </div>`).join('')
                : '<p style="margin:0;color:rgba(255,255,255,0.6);">Достижения не указаны</p>';

            updateModalAdminActions();

            teamModal.classList.add('active');
            teamModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeTeamModal() {
            teamModal.classList.remove('active');
            teamModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            state.selectedTeam = null;
        }

        function openTeamForm(team = null) {
            state.editingTeam = team;
            teamForm.reset();

            if (team) {
                teamFormTitle.textContent = 'Редактировать команду';
                teamForm.querySelector('[name="name"]').value = team.name || '';
                teamForm.querySelector('[name="country"]').value = team.country || '';
                teamForm.querySelector('[name="founded"]').value = team.founded ?? '';
                teamForm.querySelector('[name="series"]').value = team.series.join(', ');
                teamForm.querySelector('[name="cars"]').value = team.cars.join(', ');
                teamForm.querySelector('[name="logo"]').value = team.logo || '';
                teamForm.querySelector('[name="image"]').value = team.image_url || '';
                teamForm.querySelector('[name="description"]').value = team.description || '';
                teamForm.querySelector('[name="stats_races"]').value = team.stats.races ?? '';
                teamForm.querySelector('[name="stats_wins"]').value = team.stats.wins ?? '';
                teamForm.querySelector('[name="stats_podiums"]').value = team.stats.podiums ?? '';
                teamForm.querySelector('[name="stats_titles"]').value = team.stats.titles ?? '';
                teamForm.querySelector('[name="achievements"]').value = achievementsToTextarea(team.achievements);
            } else {
                teamFormTitle.textContent = 'Добавить команду';
            }

            teamFormModal.classList.add('active');
            teamFormModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeTeamForm() {
            teamFormModal.classList.remove('active');
            teamFormModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            state.editingTeam = null;
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
            updateModalAdminActions();
        }

        function updateModalAdminActions() {
            const isAdmin = auth.isAdmin();
            const container = document.getElementById('team-modal-admin');
            if (!container) {
                return;
            }
            container.style.display = isAdmin && state.selectedTeam ? 'flex' : 'none';
        }

        function collectFormPayload() {
            const formData = new FormData(teamForm);

            const series = parseStringArray(formData.get('series'));
            const cars = parseStringArray(formData.get('cars'));
            const achievements = parseAchievements(formData.get('achievements'));

            const stats = {
                races: numberOrNull(formData.get('stats_races')),
                wins: numberOrNull(formData.get('stats_wins')),
                podiums: numberOrNull(formData.get('stats_podiums')),
                titles: numberOrNull(formData.get('stats_titles')),
            };

            return {
                name: formData.get('name') || '',
                country: (formData.get('country') || '').toLowerCase(),
                founded: numberOrNull(formData.get('founded')),
                series,
                cars,
                logo: formData.get('logo') || '',
                image_url: formData.get('image') ? String(formData.get('image')).trim() : null,
                description: formData.get('description') || '',
                stats,
                achievements,
            };
        }

        function numberOrNull(value) {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const number = Number(value);
            return Number.isNaN(number) ? null : number;
        }

        async function saveTeam(event) {
            event.preventDefault();
            if (state.saving) {
                return;
            }

            const payload = collectFormPayload();

            try {
                state.saving = true;
                if (state.editingTeam) {
                    const updated = await api.put(`teams/${state.editingTeam.id}`, payload);
                    const mapped = mapTeam(updated, state.editingTeam.id);
                    if (mapped) {
                        state.allTeams = state.allTeams.map(team => team.id === mapped.id ? mapped : team);
                        renderTeams(state.allTeams);
                        if (state.selectedTeam && state.selectedTeam.id === mapped.id) {
                            state.selectedTeam = mapped;
                            openTeamModal(mapped);
                        }
                    }
                } else {
                    const created = await api.post('teams', payload);
                    const mapped = mapTeam(created, state.allTeams.length);
                    if (mapped) {
                        state.allTeams.unshift(mapped);
                        renderTeams(state.allTeams);
                    }
                }

                closeTeamForm();
            } catch (error) {
                console.error('[teams.js] Не удалось сохранить команду:', error);
                alert(error.message || 'Ошибка сохранения команды');
            } finally {
                state.saving = false;
            }
        }

        async function deleteTeam() {
            if (!state.selectedTeam) {
                return;
            }
            if (!confirm(`Удалить команду «${state.selectedTeam.name}»?`)) {
                return;
            }
            try {
                await api.delete(`teams/${state.selectedTeam.id}`);
                state.allTeams = state.allTeams.filter(team => team.id !== state.selectedTeam.id);
                renderTeams(state.allTeams);
                closeTeamModal();
            } catch (error) {
                console.error('[teams.js] Не удалось удалить команду:', error);
                alert(error.message || 'Ошибка удаления команды');
            }
        }

        async function loadTeams() {
            state.loading = true;
            try {
                const data = await api.get('teams');
                if (Array.isArray(data)) {
                    state.allTeams = data.map((team, index) => mapTeam(team, index)).filter(Boolean);
                    renderTeams(state.allTeams);
                }
            } catch (error) {
                console.error('[teams.js] Не удалось загрузить команды:', error);
                teamsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Ошибка загрузки данных. Попробуйте позже.</p>';
            } finally {
                state.loading = false;
            }
        }

        function bindEvents() {
            attachModalHandlers();

            if (addTeamBtn) {
                addTeamBtn.addEventListener('click', () => openTeamForm());
            }
            if (editTeamBtn) {
                editTeamBtn.addEventListener('click', () => {
                    if (state.selectedTeam) {
                        openTeamForm(state.selectedTeam);
                    } else {
                        alert('Сначала откройте команду для просмотра.');
                    }
                });
            }
            if (teamModalEdit) {
                teamModalEdit.addEventListener('click', () => {
                    if (state.selectedTeam) {
                        openTeamForm(state.selectedTeam);
                    }
                });
            }
            if (teamModalDelete) {
                teamModalDelete.addEventListener('click', deleteTeam);
            }

            teamForm.addEventListener('submit', saveTeam);
        }

        function subscribeAuth() {
            if (typeof auth.onChange === 'function') {
                auth.onChange(() => {
                    updateAdminControls();
                });
            }
            updateAdminControls();
        }

        bindEvents();
        subscribeAuth();
        loadTeams();

        window.GT3 = window.GT3 || {};
        window.GT3.teams = {
            reload: loadTeams,
            getAll() {
                return state.allTeams.slice();
            },
        };
    }
})();
