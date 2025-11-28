// comparison.js: compare favorite cars using localStorage + API cache
(function () {
    const MAX = 3;
    const STORAGE_KEY = 'gt3_compare';
    const cache = new Map();

    function getCompareIds() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = JSON.parse(raw || '[]');
            return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
        } catch (error) {
            console.warn('[comparison] Некорректные данные сравнения:', error);
            localStorage.removeItem(STORAGE_KEY);
            return [];
        }
    }

    function setCompareIds(ids) {
        const sanitized = Array.from(new Set(ids)).slice(0, MAX);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }

    async function ensureCars(ids) {
        const missing = ids.filter(id => !cache.has(id));
        if (!missing.length) {
            return ids.map(id => cache.get(id)).filter(Boolean);
        }

        const api = window.GT3 && window.GT3.api;
        if (!api) {
            console.error('[comparison] API клиент не найден');
            return ids.map(id => cache.get(id)).filter(Boolean);
        }

        try {
            const list = await api.get('cars', { ids: missing.join(',') });
            if (Array.isArray(list)) {
                list.forEach(car => {
                    cache.set(car.id, car);
                });
            }
        } catch (error) {
            console.error('[comparison] Не удалось загрузить данные автомобилей:', error);
        }

        return ids.map(id => cache.get(id)).filter(Boolean);
    }

    function syncButtons() {
        const ids = getCompareIds();
        document.querySelectorAll('.btn-compare').forEach((button) => {
            const id = Number(button.dataset.id);
            if (Number.isNaN(id)) {
                return;
            }
            button.textContent = ids.includes(id) ? '✓' : '+';
        });
    }

    function attachCompareButtons() {
        document.querySelectorAll('.btn-compare').forEach((button) => {
            const id = Number(button.dataset.id);
            if (Number.isNaN(id)) {
                return;
            }

            if (button.dataset.bound === 'true') {
                return;
            }
            button.dataset.bound = 'true';

            button.addEventListener('click', () => {
                const ids = getCompareIds();
                if (ids.includes(id)) {
                    setCompareIds(ids.filter(item => item !== id));
                } else {
                    if (ids.length >= MAX) {
                        alert(`Максимум ${MAX} автомобилей для сравнения`);
                        return;
                    }
                    ids.push(id);
                    setCompareIds(ids);
                }
                syncButtons();
                updateCompareTrigger();
            });
        });
        syncButtons();
    }

    function updateCompareTrigger() {
        const button = document.getElementById('compare-open');
        if (!button) {
            return;
        }

        const ids = getCompareIds();
        button.disabled = !ids.length;
        button.textContent = ids.length ? `Открыть сравнение (${ids.length})` : 'Открыть сравнение';
        button.onclick = () => openCompareModal(ids);
    }

    async function openCompareModal(ids) {
        const cars = await ensureCars(ids);
        if (!cars.length) {
            alert('Нет данных для сравнения.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.tabIndex = -1;

        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.innerHTML = '<h2>Сравнение автомобилей</h2>';

        const table = document.createElement('table');
        table.className = 'compare-table';
        table.innerHTML = buildTableHtml(cars);
        panel.appendChild(table);

        const footer = document.createElement('div');
        footer.className = 'compare-footer';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn-secondary';
        clearBtn.textContent = 'Очистить сравнение';
        clearBtn.addEventListener('click', () => {
            setCompareIds([]);
            syncButtons();
            updateCompareTrigger();
            document.body.removeChild(modal);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-secondary';
        closeBtn.textContent = 'Закрыть';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        footer.appendChild(clearBtn);
        footer.appendChild(closeBtn);
        panel.appendChild(footer);

        modal.appendChild(panel);
        document.body.appendChild(modal);
        modal.focus();
    }

    function buildTableHtml(cars) {
        const columns = cars.map(car => `
            <th>
                ${escapeHtml(car.brand || '')} ${escapeHtml(car.model || '')}
                <div class="compare-sub">${escapeHtml(car.generation || '')}</div>
            </th>
        `).join('');

        const rows = [
            ['Год', car => car.year ?? '—'],
            ['Двигатель', car => car.engine || '—'],
            ['Мощность, л.с.', car => car.power ?? '—'],
            ['Крутящий момент, Нм', car => car.torque ?? '—'],
            ['Вес, кг', car => car.weight ?? '—'],
            ['Макс. скорость, км/ч', car => car.top_speed ?? car.topSpeed ?? '—'],
        ].map(([label, getValue]) => {
            const cells = cars.map(car => `<td>${escapeHtml(String(getValue(car)))}</td>`).join('');
            return `<tr><td><strong>${escapeHtml(label)}</strong></td>${cells}</tr>`;
        }).join('');

        return `<thead><tr><th></th>${columns}</tr></thead><tbody>${rows}</tbody>`;
    }

    function escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    document.addEventListener('DOMContentLoaded', () => {
        attachCompareButtons();
        updateCompareTrigger();
    });

    window.initCompareButtons = attachCompareButtons;
})();
