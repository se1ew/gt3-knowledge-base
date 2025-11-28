(function () {
    const DEFAULT_SORT = 'default';

    document.addEventListener('DOMContentLoaded', () => {
        const api = window.GT3 && window.GT3.api;
        const auth = window.GT3 && window.GT3.auth;

        const carGrid = document.getElementById('car-grid');
        const resultsCount = document.getElementById('results-count');
        const searchInput = document.getElementById('car-search');
        const sortSelect = document.getElementById('sort-select');
        const filtersForm = document.getElementById('filters-form');
        const toggleFiltersBtn = document.getElementById('toggle-filters');
        const filtersSidebar = document.querySelector('.filters-sidebar');
        const yearRange = document.getElementById('year-range');
        const yearValue = document.getElementById('year-value');
        const powerRange = document.getElementById('power-range');
        const powerValue = document.getElementById('power-value');
        const clearFiltersBtn = document.getElementById('clear-filters');

        const detailModal = document.getElementById('car-detail-modal');
        const detailTitle = document.getElementById('car-detail-title');
        const detailName = document.getElementById('detail-car-name');
        const detailMeta = document.getElementById('detail-car-meta');
        const detailTags = document.getElementById('detail-car-tags');
        const detailImage = document.getElementById('detail-car-image');
        const detailStats = document.getElementById('detail-car-stats');
        const detailDetails = document.getElementById('detail-car-details');
        const detailClose = document.getElementById('car-detail-close');
        const detailCloseFooter = document.getElementById('car-detail-close-footer');

        const editCarBtn = document.getElementById('edit-car-btn');
        const deleteCarBtn = document.getElementById('delete-car-btn');
        const addCarModal = document.getElementById('add-car-modal');
        const addCarForm = document.getElementById('add-car-form');

        if (!api || !auth) {
            console.error('[cars.js] API или AuthManager недоступны');
            return;
        }

        if (!carGrid) {
            console.error('[cars.js] Элемент car-grid не найден');
            return;
        }

        const state = {
            allCars: [],
            filteredCars: [],
            searchQuery: '',
            sortOption: DEFAULT_SORT,
            loading: false,
            saving: false,
            selectedCarId: null,
        };

        const urlParams = new URLSearchParams(window.location.search);
        const initialSearch = urlParams.get('search');
        if (searchInput && initialSearch) {
            const value = initialSearch.trim();
            searchInput.value = value;
            state.searchQuery = value.toLowerCase();
        }

        function normalizeBrand(brand) {
            if (!brand) return '';
            return brand.charAt(0).toUpperCase() + brand.slice(1);
        }

        function buildImagePath(car) {
            if (!car.image_url && !car.image) {
                return 'images/car-placeholder.svg';
            }
            const candidate = car.image_url || car.image;
            return candidate.startsWith('http') ? candidate : candidate.replace(/^\/?/, '');
        }

        function createCarCard(car) {
            const card = document.createElement('article');
            card.className = 'car-card';
            card.dataset.id = car.id;
            card.innerHTML = `
                <div class="car-image">
                    <img src="${buildImagePath(car)}" alt="${normalizeBrand(car.brand)} ${car.model}" loading="lazy" onerror="this.src='images/car-placeholder.svg'">
                </div>
                <div class="car-info">
                    <h3 class="car-title">${normalizeBrand(car.brand)} ${car.model}</h3>
                    <p class="car-meta">${[car.year, car.engine, car.power ? car.power + ' л.с.' : ''].filter(Boolean).join(' • ')}</p>
                    <div class="car-actions">
                        <button class="btn-primary btn-detail" data-id="${car.id}" type="button">Подробнее</button>
                    </div>
                </div>
            `;
            return card;
        }

        function renderCars(list) {
            if (!carGrid) return;

            if (!list.length) {
                carGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Автомобили не найдены</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            list.forEach(car => {
                fragment.appendChild(createCarCard(car));
            });

            carGrid.innerHTML = '';
            carGrid.appendChild(fragment);

            attachCardEvents();
        }

        function updateResultsCounter(listLength) {
            if (!resultsCount) return;
            const base = `${listLength} ${(listLength === 1 ? 'автомобиль' : listLength >= 2 && listLength <= 4 ? 'автомобиля' : 'автомобилей')}`;
            if (state.searchQuery) {
                resultsCount.textContent = `${base} найдено по запросу "${searchInput ? searchInput.value.trim() : state.searchQuery}"`;
                resultsCount.style.color = 'var(--accent-red)';
            } else {
                resultsCount.textContent = base;
                resultsCount.style.color = '';
            }
        }

        function getCheckedBrands() {
            if (!filtersForm) return [];
            return Array.from(filtersForm.querySelectorAll('input[name="brand"]:checked')).map(input => input.value);
        }

        function resetFilters() {
            if (filtersForm) {
                filtersForm.querySelectorAll('input[name="brand"]').forEach((input) => {
                    input.checked = false;
                });
            }

            if (searchInput) {
                searchInput.value = '';
            }
            state.searchQuery = '';

            if (yearRange) {
                const maxYear = yearRange.getAttribute('data-default') || yearRange.max || yearRange.value;
                yearRange.value = maxYear;
                if (yearValue) {
                    yearValue.textContent = maxYear;
                }
            }

            if (powerRange) {
                const maxPower = powerRange.getAttribute('data-default') || powerRange.max || powerRange.value;
                powerRange.value = maxPower;
                if (powerValue) {
                    powerValue.textContent = `${maxPower}+ л.с.`;
                }
            }

            if (sortSelect) {
                sortSelect.value = DEFAULT_SORT;
            }
            state.sortOption = DEFAULT_SORT;

            applyFilters();
        }

        function applyFilters() {
            let list = state.allCars.slice();

            if (state.searchQuery) {
                const query = state.searchQuery;
                list = list.filter(car => {
                    const haystack = [car.brand, car.model, car.generation, car.engine, car.year].join(' ').toLowerCase();
                    return haystack.includes(query);
                });
            }

            const selectedBrands = new Set(getCheckedBrands());
            if (selectedBrands.size) {
                list = list.filter(car => selectedBrands.has(car.brand));
            }

            if (yearRange) {
                const maxYear = Number(yearRange.value);
                list = list.filter(car => !car.year || car.year <= maxYear);
            }

            if (powerRange) {
                const maxPower = Number(powerRange.value);
                list = list.filter(car => !car.power || car.power <= maxPower);
            }

            switch (state.sortOption) {
                case 'power-desc':
                    list.sort((a, b) => (b.power || 0) - (a.power || 0));
                    break;
                case 'power-asc':
                    list.sort((a, b) => (a.power || 0) - (b.power || 0));
                    break;
                case 'year-desc':
                    list.sort((a, b) => (b.year || 0) - (a.year || 0));
                    break;
                case 'year-asc':
                    list.sort((a, b) => (a.year || 0) - (b.year || 0));
                    break;
                default:
                    // keep original order
                    break;
            }

            state.filteredCars = list;
            updateResultsCounter(list.length);
            renderCars(list);
            updateSelectedCardHighlight();
        }

        function formatValue(value, suffix) {
            if (value === null || value === undefined || value === '' || Number.isNaN(value)) {
                return '—';
            }
            return suffix ? `${value} ${suffix}` : value;
        }

        function populateDetailModal(car) {
            if (!detailModal) return;

            detailTitle.textContent = 'Подробнее об автомобиле';
            detailName.textContent = `${normalizeBrand(car.brand)} ${car.model}`;

            const metaParts = [];
            if (car.generation) metaParts.push(car.generation);
            if (car.year) metaParts.push(`${car.year} год`);
            detailMeta.textContent = metaParts.join(' • ');

            if (detailImage) {
                detailImage.src = buildImagePath(car);
                detailImage.alt = `${normalizeBrand(car.brand)} ${car.model}`;
            }

            if (detailTags) {
                const tags = [];
                if (car.brand) tags.push(normalizeBrand(car.brand));
                if (car.engine) tags.push(car.engine);
                detailTags.innerHTML = tags.map(tag => `<span class="modal-tag">${tag}</span>`).join('');
            }

            if (detailStats) {
                const statsTemplate = [
                    { label: 'Мощность', value: car.power ? `${car.power} л.с.` : null },
                    { label: 'Крутящий момент', value: car.torque ? `${car.torque} Нм` : null },
                    { label: 'Вес', value: car.weight ? `${car.weight} кг` : null },
                    { label: 'Макс. скорость', value: car.topSpeed ? `${car.topSpeed} км/ч` : null }
                ].filter(item => item.value);

                if (statsTemplate.length) {
                    detailStats.innerHTML = statsTemplate.map(item => `
                        <div class="modal-stat">
                            <div class="value">${item.value}</div>
                            <div class="label">${item.label}</div>
                        </div>
                    `).join('');
                } else {
                    detailStats.innerHTML = '<p style="opacity:0.7">Нет подробных характеристик</p>';
                }
            }

            if (detailDetails) {
                const rows = [
                    { label: 'Модель', value: car.model },
                    { label: 'Поколение', value: car.generation },
                    { label: 'Год выпуска', value: car.year },
                    { label: 'Двигатель', value: car.engine },
                    { label: 'Мощность', value: car.power, suffix: 'л.с.' },
                    { label: 'Крутящий момент', value: car.torque, suffix: 'Нм' },
                    { label: 'Вес', value: car.weight, suffix: 'кг' },
                    { label: 'Макс. скорость', value: car.topSpeed, suffix: 'км/ч' }
                ];

                detailDetails.innerHTML = `
                    <div class="detail-card">
                        <h3>Технические характеристики</h3>
                        <div class="detail-list">
                            ${rows.map(row => `
                                <div class="detail-row">
                                    <span class="detail-label">${row.label}</span>
                                    <span>${formatValue(row.value, row.suffix)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            detailModal.classList.add('active');
            detailModal.setAttribute('aria-hidden', 'false');
            selectCarById(car.id);
        }

        function closeDetailModal() {
            if (!detailModal) return;
            detailModal.classList.remove('active');
            detailModal.setAttribute('aria-hidden', 'true');
        }

        async function deleteSelectedCar() {
            if (!requireSelection('Удалить')) {
                return;
            }
            const carId = state.selectedCarId;
            const car = state.allCars.find((item) => String(item.id) === String(carId));
            if (!car) {
                alert('Выберите автомобиль из текущего списка.');
                return;
            }
            if (!confirm(`Удалить ${normalizeBrand(car.brand)} ${car.model}?`)) {
                return;
            }
            try {
                state.saving = true;
                await api.delete(`cars/${carId}`);
                state.allCars = state.allCars.filter((item) => String(item.id) !== String(carId));
                applyFilters();
                closeDetailModal();
                closeAddCarModal();
                state.selectedCarId = null;
                updateSelectedCardHighlight();
            } catch (error) {
                console.error('[cars.js] Не удалось удалить автомобиль:', error);
                alert(error.message || 'Удаление не удалось.');
            } finally {
                state.saving = false;
            }
        }

        async function editSelectedCar() {
            if (!requireSelection('Редактировать')) {
                return;
            }
            const carId = state.selectedCarId;
            const car = state.allCars.find((item) => String(item.id) === String(carId));
            if (!car) {
                alert('Выберите автомобиль из текущего списка.');
                return;
            }
            openAddCarModal(car);
            addCarForm.dataset.mode = 'edit';
            addCarForm.dataset.id = carId;
        }

        function attachCardEvents() {
            carGrid.querySelectorAll('.btn-detail').forEach((button) => {
                button.addEventListener('click', () => {
                    const id = button.getAttribute('data-id');
                    const car = state.filteredCars.find((item) => String(item.id) === String(id));
                    if (car) {
                        populateDetailModal(car);
                    }
                });
            });
        }

        function openAddCarModal(prefill = null) {
            if (!addCarModal) return;
            addCarModal.classList.add('active');
            if (prefill && addCarForm) {
                addCarForm.querySelector('#new-car-brand').value = (prefill.brand || '').toLowerCase();
                addCarForm.querySelector('#new-car-model').value = prefill.model || '';
                addCarForm.querySelector('#new-car-generation').value = prefill.generation || '';
                addCarForm.querySelector('#new-car-year').value = prefill.year || '';
                addCarForm.querySelector('#new-car-engine').value = prefill.engine || '';
                addCarForm.querySelector('#new-car-power').value = prefill.power || '';
                addCarForm.querySelector('#new-car-torque').value = prefill.torque || '';
                addCarForm.querySelector('#new-car-weight').value = prefill.weight || '';
                addCarForm.querySelector('#new-car-topspeed').value = prefill.topSpeed || '';
                addCarForm.querySelector('#new-car-image').value = prefill.image ? prefill.image.replace(/^images\/cars\//, '') : '';
            } else if (addCarForm) {
                addCarForm.reset();
            }
        }

        function closeAddCarModal() {
            if (addCarModal) {
                addCarModal.classList.remove('active');
            }
        }

        function requireSelection(action) {
            if (!state.selectedCarId) {
                alert('Выберите автомобиль из списка перед действием «' + action + '».');
                return false;
            }
            return true;
        }

        function selectCarById(id) {
            state.selectedCarId = id;
            updateSelectedCardHighlight();
        }

        if (detailClose) {
            detailClose.addEventListener('click', closeDetailModal);
        }

        if (detailCloseFooter) {
            detailCloseFooter.addEventListener('click', closeDetailModal);
        }

        if (detailModal) {
            detailModal.addEventListener('click', (event) => {
                if (event.target === detailModal) {
                    closeDetailModal();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && detailModal && detailModal.classList.contains('active')) {
                closeDetailModal();
            }
        });

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                state.searchQuery = searchInput.value.trim().toLowerCase();
                applyFilters();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                state.sortOption = sortSelect.value || DEFAULT_SORT;
                applyFilters();
            });
        }

        if (filtersForm) {
            filtersForm.addEventListener('change', (event) => {
                if (event.target && event.target.name === 'brand') {
                    applyFilters();
                }
            });
        }

        if (toggleFiltersBtn && filtersSidebar) {
            toggleFiltersBtn.addEventListener('click', () => {
                filtersSidebar.classList.toggle('active');
            });
        }

        if (yearRange && yearValue) {
            yearValue.textContent = yearRange.value;
            yearRange.addEventListener('input', () => {
                yearValue.textContent = yearRange.value;
                applyFilters();
            });
        }

        if (powerRange && powerValue) {
            powerValue.textContent = powerRange.value + '+ л.с.';
            powerRange.addEventListener('input', () => {
                powerValue.textContent = powerRange.value + '+ л.с.';
                applyFilters();
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                resetFilters();
            });
        }

        function initAdminFeatures() {
            const adminControls = document.getElementById('admin-controls');
            const addCarBtn = document.getElementById('add-car-btn');
            const addCarClose = document.getElementById('add-car-close');

            if (!adminControls) {
                return;
            }

            if (!auth.isAdmin()) {
                adminControls.classList.remove('active');
                return;
            }

            adminControls.classList.add('active');

            if (addCarBtn && addCarModal) {
                addCarBtn.addEventListener('click', () => {
                    state.selectedCarId = null;
                    addCarForm.dataset.mode = 'create';
                    addCarForm.dataset.id = '';
                    openAddCarModal();
                });
            }

            if (editCarBtn) {
                editCarBtn.addEventListener('click', editSelectedCar);
            }

            if (deleteCarBtn) {
                deleteCarBtn.addEventListener('click', deleteSelectedCar);
            }

            if (addCarClose && addCarModal) {
                addCarClose.addEventListener('click', closeAddCarModal);
                addCarModal.addEventListener('click', (event) => {
                    if (event.target === addCarModal) {
                        closeAddCarModal();
                    }
                });
            }

            if (addCarForm) {
                addCarForm.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    if (state.saving) {
                        return;
                    }
                    const formData = new FormData(addCarForm);
                    const payload = {
                        brand: (formData.get('brand') || '').toLowerCase(),
                        model: formData.get('model') || '',
                        generation: formData.get('generation') || '',
                        year: formData.get('year') ? Number(formData.get('year')) : null,
                        engine: formData.get('engine') || '',
                        power: formData.get('power') ? Number(formData.get('power')) : null,
                        torque: formData.get('torque') ? Number(formData.get('torque')) : null,
                        weight: formData.get('weight') ? Number(formData.get('weight')) : null,
                        top_speed: formData.get('topSpeed') ? Number(formData.get('topSpeed')) : null,
                        image_url: formData.get('image') ? `images/cars/${formData.get('image')}` : null,
                        description: formData.get('description') || null,
                    };

                    try {
                        state.saving = true;
                        const mode = addCarForm.dataset.mode || 'create';
                        if (mode === 'edit' && addCarForm.dataset.id) {
                            const id = addCarForm.dataset.id;
                            const updated = await api.put(`cars/${id}`, payload);
                            const mapped = mapCar(updated);
                            if (mapped) {
                                const idx = state.allCars.findIndex((car) => String(car.id) === String(id));
                                if (idx !== -1) {
                                    state.allCars[idx] = mapped;
                                }
                                applyFilters();
                                selectCarById(mapped.id);
                            }
                        } else {
                            const created = await api.post('cars', payload);
                            const mapped = mapCar(created, state.allCars.length);
                            if (mapped) {
                                state.allCars.unshift(mapped);
                                applyFilters();
                                selectCarById(mapped.id);
                            }
                        }
                        addCarForm.reset();
                        addCarForm.dataset.mode = 'create';
                        addCarForm.dataset.id = '';
                        closeAddCarModal();
                        updateSelectedCardHighlight();
                    } catch (error) {
                        console.error('[cars.js] Не удалось создать автомобиль:', error);
                        alert(error.message || 'Не удалось сохранить автомобиль');
                    } finally {
                        state.saving = false;
                    }
                });
            }
        }

        function mapCar(raw, index = 0) {
            if (!raw) {
                return null;
            }
            return {
                id: raw.id ?? index,
                brand: (raw.brand || '').toLowerCase(),
                model: raw.model || '',
                generation: raw.generation || '',
                year: raw.year || null,
                engine: raw.engine || '',
                power: raw.power || null,
                torque: raw.torque || null,
                weight: raw.weight || null,
                topSpeed: raw.top_speed ?? raw.topSpeed ?? null,
                image: raw.image || raw.image_url || '',
                image_url: raw.image_url || '',
                description: raw.description || '',
                created_at: raw.created_at,
                updated_at: raw.updated_at,
            };
        }

        async function fetchCars() {
            state.loading = true;
            try {
                const data = await api.get('cars');
                if (Array.isArray(data)) {
                    state.allCars = data.map((car, index) => mapCar(car, index)).filter(Boolean);
                    applyFilters();
                }
            } catch (error) {
                console.error('[cars.js] Не удалось загрузить автомобили:', error);
                carGrid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:2rem;">Ошибка загрузки данных. Попробуйте позже.</p>';
            } finally {
                state.loading = false;
            }
        }

        function subscribeAuth() {
            if (typeof auth.onChange !== 'function') {
                initAdminFeatures();
                return;
            }
            auth.onChange(() => {
                initAdminFeatures();
            });
        }

        carGrid.addEventListener('click', (event) => {
            const card = event.target.closest('.car-card');
            if (!card) return;
            const id = card.dataset.id;
            selectCarById(id);
        });

        function updateSelectedCardHighlight() {
            if (!carGrid) return;
            const { selectedCarId } = state;
            carGrid.querySelectorAll('.car-card').forEach((card) => {
                if (selectedCarId && String(card.dataset.id) === String(selectedCarId)) {
                    card.classList.add('car-card--selected');
                } else {
                    card.classList.remove('car-card--selected');
                }
            });
        }

        subscribeAuth();
        fetchCars();
        initAdminFeatures();
    });
})();
