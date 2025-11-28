(function () {
    const API_BASE = '/api';
    const AUTH_STORAGE_KEY = 'gt3_auth_session_v1';

    function safeParse(json) {
        if (!json) return null;
        try {
            return JSON.parse(json);
        } catch (error) {
            console.warn('[api] Failed to parse session from storage:', error);
            return null;
        }
    }

    function getSession() {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        return safeParse(stored);
    }

    function persistSession(session) {
        if (!session) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
        } else {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        }
        document.dispatchEvent(new CustomEvent('gt3:auth:change', { detail: session }));
    }

    function clearSession() {
        persistSession(null);
    }

    function buildUrl(path, params) {
        const url = new URL(path.replace(/^\//, ''), window.location.origin + API_BASE + '/');
        if (params && typeof params === 'object') {
            Object.entries(params)
                .filter(([, value]) => value !== undefined && value !== null && value !== '')
                .forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });
        }
        return url.toString();
    }

    async function request(path, options = {}) {
        const {
            method = 'GET',
            body,
            headers = {},
            params,
            auth = true,
            raw = false,
        } = options;

        const url = buildUrl(path, params);
        const session = getSession();

        const requestInit = {
            method,
            headers: {
                Accept: 'application/json',
                ...headers,
            },
        };

        if (auth && session?.token) {
            requestInit.headers.Authorization = `Bearer ${session.token}`;
        }

        if (body !== undefined) {
            if (body instanceof FormData) {
                requestInit.body = body;
            } else {
                requestInit.headers['Content-Type'] = 'application/json';
                requestInit.body = JSON.stringify(body);
            }
        }

        let response;
        try {
            response = await fetch(url, requestInit);
        } catch (networkError) {
            throw new Error('Не удалось связаться с сервером. Проверьте подключение к сети.');
        }

        if (response.status === 401 || response.status === 403) {
            if (auth && session) {
                clearSession();
            }
        }

        if (!response.ok) {
            let message = `Ошибка ${response.status}`;
            try {
                const payload = await response.json();
                if (payload?.message) {
                    message = payload.message;
                }
            } catch (error) {
                // ignore JSON parse errors
            }
            throw new Error(message);
        }

        if (response.status === 204 || raw) {
            return null;
        }

        try {
            return await response.json();
        } catch (parseError) {
            return null;
        }
    }

    async function login(email, password) {
        const result = await request('auth/login', {
            method: 'POST',
            body: { email, password },
            auth: false,
        });
        if (!result || !result.token) {
            throw new Error('Некорректный ответ сервера при входе');
        }
        persistSession(result);
        return result;
    }

    function logout() {
        clearSession();
    }

    const api = {
        request,
        get(path, params, options = {}) {
            return request(path, { ...options, params, method: 'GET' });
        },
        post(path, body, options = {}) {
            return request(path, { ...options, method: 'POST', body });
        },
        put(path, body, options = {}) {
            return request(path, { ...options, method: 'PUT', body });
        },
        delete(path, options = {}) {
            return request(path, { ...options, method: 'DELETE' });
        },
        login,
        logout,
        async register(email, password, displayName) {
            const response = await this.post('/auth/register', {
                email,
                password,
                display_name: displayName
            }, { auth: false });
            return response;
        },
        getSession,
        isAuthenticated() {
            const session = getSession();
            return Boolean(session && session.token);
        },
    };

    window.GT3 = window.GT3 || {};
    window.GT3.api = api;
})();
