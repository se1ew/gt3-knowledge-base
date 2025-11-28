(function () {
    const DEFAULT_IMAGE = 'images/track-placeholder.svg';

    const state = {
        allTracks: [],
        loading: false,
        saving: false,
        editingTrack: null,
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
    ]).then(initTracksPage);

    function initTracksPage() {
        const trackGrid = document.getElementById('track-grid');
        const modal = document.getElementById('track-modal');
        const modalTitle = document.getElementById('modal-track-title');
        const modalContent = document.getElementById('track-modal-content');
        const modalClose = document.getElementById('track-modal-close');
        const adminControls = document.getElementById('admin-track-controls');
        const addTrackBtn = document.getElementById('add-track-btn');
        const addTrackModal = document.getElementById('add-track-modal');
        const addTrackClose = document.getElementById('add-track-close');
        const addTrackForm = document.getElementById('add-track-form');
        const deleteTrackBtn = document.getElementById('delete-track-btn');
        const editTrackBtn = document.getElementById('edit-track-btn');

        const api = window.GT3 && window.GT3.api;
        const auth = window.GT3 && window.GT3.auth;

        if (!api || !auth) {
            console.error('[tracks.js] API или AuthManager недоступны');
            return;
        }

        if (!trackGrid || !modal || !modalTitle || !modalContent || !modalClose) {
            return;
        }

        function getCountryName(countryCode) {
            const countries = {
                belgium: 'Бельгия',
                germany: 'Германия',
                italy: 'Италия',
                uk: 'Великобритания',
                france: 'Франция',
                spain: 'Испания',
                usa: 'США',
                japan: 'Япония',
                bahrain: 'Бахрейн',
                australia: 'Австралия',
                portugal: 'Португалия',
                malaysia: 'Малайзия',
                china: 'Китай',
                netherlands: 'Нидерланды'
            };
            return countries[countryCode] || countryCode;
        }

        function getTypeName(typeCode) {
            const types = {
                permanent: 'Постоянная трасса',
                street: 'Уличная трасса'
            };
            return types[typeCode] || typeCode;
        }

        function normalizeImagePath(path) {
            if (!path) {
                return '';
            }
            const candidate = String(path).trim();
            if (!candidate) {
                return '';
            }
            if (candidate.startsWith('http')) {
                return candidate;
            }
            return candidate.replace(/^\/+/, '');
        }

        function ensureImageUrl(value, type, fallback = '') {
            const raw = value !== undefined && value !== null ? String(value).trim() : '';

            if (!raw) {
                return fallback || '';
            }

            if (raw.startsWith('http')) {
                return raw;
            }

            let cleaned = raw
                .replace(/\\/g, '/')
                .replace(/^images\//, '')
                .replace(/^\/+/, '');

            if (!cleaned) {
                return fallback || '';
            }

            if (cleaned.startsWith('tracks/')) {
                return `images/${cleaned}`;
            }

            const folder = type === 'detail' ? 'tracks/detail' : 'tracks/layout';

            if (cleaned.startsWith('layout/')) {
                cleaned = cleaned.replace(/^layout\//, '');
            } else if (cleaned.startsWith('detail/')) {
                cleaned = cleaned.replace(/^detail\//, '');
            }

            return `images/${folder}/${cleaned}`;
        }

        function createTrackCard(track) {
            const card = document.createElement('article');
            card.className = 'track-card';
            card.innerHTML = `
                <div class="track-image">
                    <span class="track-badge">${getCountryName(track.country)}</span>
                    <img src="${track.cardImage || DEFAULT_IMAGE}" alt="${track.name}" onerror="this.src='${DEFAULT_IMAGE}'">
                </div>
                <div class="track-content">
                    <div class="track-header">
                        <h3 class="track-title">${track.name}</h3>
                        <div class="track-location">${track.location}</div>
                    </div>
                    <div class="track-stats">
                        <div class="track-stat">
                            <span class="stat-value">${track.length_km ?? track.length ?? '—'} км</span>
                            <span class="stat-label">Длина</span>
                        </div>
                        <div class="track-stat">
                            <span class="stat-value">${track.turns}</span>
                            <span class="stat-label">Поворотов</span>
                        </div>
                        <div class="track-stat">
                            <span class="stat-value">${track.established}</span>
                            <span class="stat-label">Основана</span>
                        </div>
                    </div>
                    <div class="track-footer">
                        <span class="track-type">${getTypeName(track.type)}</span>
                        <button class="btn-track" type="button" data-id="${track.id}">Подробнее</button>
                    </div>
                </div>`;
            return card;
        }

        function renderTracks(list) {
            trackGrid.innerHTML = '';

            if (!list.length) {
                trackGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Трассы не найдены</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            list.forEach(track => fragment.appendChild(createTrackCard(track)));
            trackGrid.appendChild(fragment);

            attachDetailHandlers();
        }

        function populateModal(track) {
            modalTitle.textContent = track.name;
            const modalImage = track.detailImage || track.cardImage || DEFAULT_IMAGE;
            modalContent.innerHTML = `
                <div class="track-modal-image">
                    <img src="${modalImage}" alt="${track.name}" onerror="this.src='${DEFAULT_IMAGE}'">
                </div>
                <div class="track-modal-info">
                    <h3>${track.name}</h3>
                    <div class="track-details">
                        <div class="detail-item">
                            <span class="detail-label">Страна</span>
                            <span class="detail-value">${getCountryName(track.country)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Длина</span>
                            <span class="detail-value">${track.length_km ?? track.length ?? '—'} км</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Повороты</span>
                            <span class="detail-value">${track.turns ?? '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Год открытия</span>
                            <span class="detail-value">${track.established ?? '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Тип</span>
                            <span class="detail-value">${getTypeName(track.type)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Расположение</span>
                            <span class="detail-value">${track.location || '—'}</span>
                        </div>
                    </div>
                    <div class="track-description">
                        <p>${track.description || 'Описание пока отсутствует.'}</p>
                    </div>
                </div>`;
        }

        function openModal(track) {
            populateModal(track);
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        function attachDetailHandlers() {
            trackGrid.querySelectorAll('.btn-track[data-id]').forEach(button => {
                button.addEventListener('click', () => {
                    const trackId = Number(button.getAttribute('data-id'));
                    const track = state.allTracks.find(item => item.id === trackId);
                    if (track) {
                        openModal(track);
                    }
                });
            });
        }

        modalClose.addEventListener('click', closeModal);
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });

        function mapTrack(raw, index = 0) {
            if (!raw) {
                return null;
            }

            const cardImageSource = ensureImageUrl(
                raw.card_image_url || raw.cardImageUrl || raw.card_image || raw.cardImage || raw.image_url || raw.image,
                'card'
            );
            const detailImageSource = ensureImageUrl(
                raw.detail_image_url || raw.detailImageUrl || raw.detail_image || raw.detailImage,
                'detail',
                cardImageSource
            );
            const cardImage = normalizeImagePath(cardImageSource);
            const detailImage = normalizeImagePath(detailImageSource) || cardImage;

            if (!cardImage) {
                return null;
            }

            return {
                id: raw.id ?? index,
                name: raw.name || 'Без названия',
                country: raw.country || '',
                length: raw.length_km ?? raw.length ?? null,
                length_km: raw.length_km ?? raw.length ?? null,
                type: raw.type || 'permanent',
                location: raw.location || '',
                turns: raw.turns ?? null,
                established: raw.established ?? null,
                image_url: detailImageSource || cardImageSource || '',
                card_image_url: cardImageSource || '',
                detail_image_url: detailImageSource || '',
                cardImage,
                detailImage,
                description: raw.description || '',
                created_at: raw.created_at,
                updated_at: raw.updated_at,
            };
        }

        async function loadTracks() {
            state.loading = true;
            try {
                const data = await api.get('tracks');
                if (Array.isArray(data)) {
                    state.allTracks = data
                        .map((track, index) => mapTrack(track, index))
                        .filter(Boolean);
                    renderTracks(state.allTracks);
                }
            } catch (error) {
                console.error('[tracks.js] Не удалось загрузить трассы:', error);
                trackGrid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:2rem;">Ошибка загрузки данных. Попробуйте позже.</p>';
            } finally {
                state.loading = false;
            }
        }

        function openAddModal(track = null) {
            if (!addTrackModal || !addTrackForm) {
                return;
            }

            state.editingTrack = track;
            addTrackForm.reset();

            if (track) {
                addTrackForm.querySelector('[name="name"]').value = track.name || '';
                addTrackForm.querySelector('[name="country"]').value = track.country || '';
                addTrackForm.querySelector('[name="length_km"]').value = track.length_km || '';
                addTrackForm.querySelector('[name="type"]').value = track.type || 'permanent';
                addTrackForm.querySelector('[name="location"]').value = track.location || '';
                addTrackForm.querySelector('[name="turns"]').value = track.turns || '';
                addTrackForm.querySelector('[name="established"]').value = track.established || '';

                const cardImageInput = addTrackForm.querySelector('[name="card_image"]') || addTrackForm.querySelector('[name="cardImage"]');
                const detailImageInput = addTrackForm.querySelector('[name="detail_image"]') || addTrackForm.querySelector('[name="detailImage"]');
                const legacyImageInput = addTrackForm.querySelector('[name="image"]');

                const normaliseForInput = (value) => {
                    if (!value) {
                        return '';
                    }
                    return String(value)
                        .replace(/^images\//, '')
                        .replace(/^tracks\/layout\//, '')
                        .replace(/^tracks\/detail\//, '')
                        .replace(/^tracks\//, '');
                };

                if (cardImageInput) {
                    cardImageInput.value = normaliseForInput(track.card_image_url || track.cardImage || '');
                }
                if (detailImageInput) {
                    detailImageInput.value = normaliseForInput(track.detail_image_url || track.detailImage || '');
                }
                if (legacyImageInput && !cardImageInput) {
                    legacyImageInput.value = normaliseForInput(track.card_image_url || track.image_url || '');
                }

                addTrackForm.querySelector('[name="description"]').value = track.description || '';
                addTrackModal.querySelector('h2').textContent = 'Редактировать трассу';
            } else {
                addTrackModal.querySelector('h2').textContent = 'Добавить трассу';
            }

            addTrackModal.classList.add('active');
        }

        function closeAddModal() {
            if (!addTrackModal) {
                return;
            }
            addTrackModal.classList.remove('active');
            state.editingTrack = null;
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

        if (addTrackBtn) {
            addTrackBtn.addEventListener('click', () => openAddModal());
        }

        if (addTrackClose && addTrackModal) {
            addTrackClose.addEventListener('click', closeAddModal);
            addTrackModal.addEventListener('click', (event) => {
                if (event.target === addTrackModal) {
                    closeAddModal();
                }
            });
        }

        if (deleteTrackBtn) {
            deleteTrackBtn.addEventListener('click', async () => {
                if (!state.editingTrack) {
                    alert('Выберите трассу для удаления в режиме редактирования.');
                    return;
                }
                if (!confirm('Удалить эту трассу?')) {
                    return;
                }
                try {
                    await api.delete(`tracks/${state.editingTrack.id}`);
                    state.allTracks = state.allTracks.filter(track => track.id !== state.editingTrack.id);
                    renderTracks(state.allTracks);
                    closeAddModal();
                } catch (error) {
                    console.error('[tracks.js] Не удалось удалить трассу:', error);
                    alert(error.message || 'Ошибка удаления трассы');
                }
            });
        }

        if (editTrackBtn) {
            editTrackBtn.addEventListener('click', () => {
                if (!state.editingTrack) {
                    alert('Выберите трассу для редактирования: откройте подробности и нажмите "Редактировать" внутри карточки.');
                }
            });
        }

        if (addTrackForm) {
            addTrackForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (state.saving) {
                    return;
                }

                const formData = new FormData(addTrackForm);

                const pickInputValue = (...values) => {
                    const found = values.find((item) => item && String(item).trim());
                    return found ? String(found).trim() : '';
                };

                const cardInputValue = pickInputValue(
                    formData.get('card_image'),
                    formData.get('cardImage'),
                    formData.get('image')
                );
                const cardImageValue = ensureImageUrl(cardInputValue, 'card');

                const detailInputValue = pickInputValue(
                    formData.get('detail_image'),
                    formData.get('detailImage'),
                    formData.get('image')
                );
                const detailImageValue = ensureImageUrl(detailInputValue, 'detail', cardImageValue);

                const payload = {
                    name: formData.get('name') || '',
                    country: (formData.get('country') || '').toLowerCase(),
                    length_km: formData.get('length_km') ? Number(formData.get('length_km')) : null,
                    type: formData.get('type') || 'permanent',
                    location: formData.get('location') || '',
                    turns: formData.get('turns') ? Number(formData.get('turns')) : null,
                    established: formData.get('established') ? Number(formData.get('established')) : null,
                    image_url: detailImageValue || cardImageValue || null,
                    card_image_url: cardImageValue || null,
                    detail_image_url: detailImageValue || null,
                    description: formData.get('description') || '',
                };

                try {
                    state.saving = true;
                    if (state.editingTrack) {
                        const updated = await api.put(`tracks/${state.editingTrack.id}`, payload);
                        const mapped = mapTrack(updated, state.allTracks.findIndex(item => item.id === state.editingTrack.id));
                        if (mapped) {
                            state.allTracks = state.allTracks.map(track => track.id === mapped.id ? mapped : track);
                            renderTracks(state.allTracks);
                        }
                    } else {
                        const created = await api.post('tracks', payload);
                        const mapped = mapTrack(created, state.allTracks.length);
                        if (mapped) {
                            state.allTracks.unshift(mapped);
                            renderTracks(state.allTracks);
                        }
                    }

                    closeAddModal();
                } catch (error) {
                    console.error('[tracks.js] Не удалось сохранить трассу:', error);
                    alert(error.message || 'Ошибка сохранения трассы');
                } finally {
                    state.saving = false;
                }
            });
        }

        if (auth.onChange) {
            auth.onChange(() => {
                updateAdminControls();
            });
        }

        loadTracks();
        updateAdminControls();

        window.GT3 = window.GT3 || {};
        window.GT3.tracks = {
            reload: loadTracks,
        };
    }
})();
