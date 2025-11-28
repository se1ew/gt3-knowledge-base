// auth.js - централизованное управление сессией и событиями авторизации
(function () {
    function getApi() {
        if (!window.GT3 || !window.GT3.api) {
            throw new Error('[AuthManager] API клиент не инициализирован');
        }
        return window.GT3.api;
    }

    function getSession() {
        try {
            return getApi().getSession();
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    function getUser() {
        const session = getSession();
        return session ? session.user : null;
    }

    const listeners = new Set();

    function notify(session) {
        listeners.forEach((listener) => {
            try {
                listener(session);
            } catch (error) {
                console.error('[AuthManager] Ошибка обработчика события авторизации:', error);
            }
        });
    }

    document.addEventListener('gt3:auth:change', (event) => {
        notify(event.detail || null);
    });

    const AuthManager = {
        isAuthenticated() {
            try {
                return getApi().isAuthenticated();
            } catch (error) {
                console.error(error);
                return false;
            }
        },

        isAdmin() {
            const user = getUser();
            return Boolean(user && user.role === 'admin');
        },

        getUser() {
            return getUser();
        },

        getToken() {
            const session = getSession();
            return session ? session.token : null;
        },

        async login(email, password) {
            if (!email || !password) {
                throw new Error('Необходимо указать email и пароль');
            }
            const api = getApi();
            const result = await api.login(email, password);
            notify(result);
            return result;
        },

        async register(email, password, displayName) {
            if (!email || !password || !displayName) {
                throw new Error('Необходимо заполнить все поля');
            }
            if (password.length < 6) {
                throw new Error('Пароль должен содержать не менее 6 символов');
            }
            const api = getApi();
            const result = await api.register(email, password, displayName);
            // Автоматически входим после успешной регистрации
            if (result && result.user) {
                const loginResult = await this.login(email, password);
                return loginResult;
            }
            return result;
        },

        logout() {
            try {
                getApi().logout();
            } finally {
                notify(null);
            }
        },

        onChange(callback) {
            if (typeof callback !== 'function') {
                return () => {};
            }
            listeners.add(callback);
            callback(getSession());
            return () => {
                listeners.delete(callback);
            };
        },
    };

    window.GT3 = window.GT3 || {};
    window.GT3.auth = AuthManager;
})();