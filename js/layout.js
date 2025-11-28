(function () {
    const PARTIALS = {
        header: 'partials/header.html',
        footer: 'partials/footer.html'
    };

    function fetchPartial(name) {
        const path = PARTIALS[name];
        if (!path) {
            return Promise.resolve(null);
        }
        return fetch(path, { cache: 'no-store' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Не удалось загрузить partial "${name}" (${response.status})`);
                }
                return response.text();
            })
            .then(html => html.trim())
            .catch(error => {
                console.error('[Partials] Ошибка загрузки:', error);
                return null;
            });
    }

    async function injectPartial(placeholder) {
        const partialName = placeholder.dataset.partial;
        if (!partialName) {
            return null;
        }

        const html = await fetchPartial(partialName);
        if (!html) {
            return null;
        }

        const template = document.createElement('template');
        template.innerHTML = html;
        const fragment = template.content.cloneNode(true);
        const firstElement = fragment.firstElementChild;

        placeholder.replaceWith(fragment);
        return { element: firstElement, name: partialName, active: placeholder.dataset.activeHref || '' };
    }

    function highlightActiveLink(headerElement, activeHref) {
        if (!headerElement || !activeHref) {
            return;
        }
        const normalized = activeHref.split('?')[0];
        headerElement.querySelectorAll('.nav-menu a').forEach(link => {
            link.removeAttribute('aria-current');
            if (link.getAttribute('href') === normalized) {
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    async function loadPartials() {
        const placeholders = Array.from(document.querySelectorAll('[data-partial]'));
        if (placeholders.length === 0) {
            return {};
        }
        const results = await Promise.all(placeholders.map(injectPartial));
        const headerResult = results.find(result => result && result.name === 'header');
        if (headerResult) {
            highlightActiveLink(headerResult.element, headerResult.active);
        }
        return results.reduce((acc, item) => {
            if (item && item.element) {
                acc[item.name] = item.element;
            }
            return acc;
        }, {});
    }

    function ready() {
        if (document.readyState === 'loading') {
            return new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        return Promise.resolve();
    }

    const partialsPromise = ready().then(loadPartials).then(result => {
        document.dispatchEvent(new CustomEvent('partials:loaded', { detail: result }));
        return result;
    });

    window.GT3 = window.GT3 || {};
    window.GT3.partialsReady = partialsPromise;
})();
