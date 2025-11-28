(function () {
    function ready() {
        if (document.readyState === 'loading') {
            return new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        return Promise.resolve();
    }

    const partialsPromise = window.GT3 && window.GT3.partialsReady
        ? window.GT3.partialsReady.catch(() => ({}))
        : Promise.resolve({});

    Promise.all([ready(), partialsPromise]).then(initIndexPage);

    function initIndexPage() {
        const navAuth = document.getElementById('nav-auth');
        const loginModal = document.getElementById('login-modal');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const loginClose = document.getElementById('login-close');
        const loginError = document.getElementById('login-error');
        const registerError = document.getElementById('register-error');
        const showRegisterLink = document.getElementById('show-register');
        const showLoginLink = document.getElementById('show-login');
        const authModalTitle = document.getElementById('auth-modal-title');
        const mainSearch = document.getElementById('main-search');
        const searchSuggestions = document.getElementById('search-suggestions');

        const api = window.GT3 && window.GT3.api;
        const auth = window.GT3 && window.GT3.auth;

        if (!api || !auth) {
            console.error('[index.js] API или AuthManager не инициализированы');
            return;
        }

        let authUnsubscribe = null;
        let lastSearchResults = [];
        let searchRequestId = 0;

        const TYPE_LABELS = {
            car: 'Автомобиль',
            track: 'Трасса',
            team: 'Команда',
            champion: 'Чемпион',
            pilot: 'Пилот',
        };

        function showLoginForm() {
            if (loginForm) loginForm.classList.add('active');
            if (registerForm) registerForm.classList.remove('active');
            if (authModalTitle) authModalTitle.textContent = 'Вход в систему';
            const emailInput = document.getElementById('login-email');
            if (emailInput) emailInput.focus();
        }

        function showRegisterForm() {
            if (loginForm) loginForm.classList.remove('active');
            if (registerForm) registerForm.classList.add('active');
            if (authModalTitle) authModalTitle.textContent = 'Регистрация';
            const emailInput = document.getElementById('register-email');
            if (emailInput) emailInput.focus();
        }

        function openLoginModal() {
            if (!loginModal) return;
            
            loginModal.classList.add('active');
            if (loginError) {
                loginError.style.display = 'none';
                loginError.textContent = '';
            }
            if (registerError) {
                registerError.style.display = 'none';
                registerError.textContent = '';
            }
            
            showLoginForm();
        }

        function closeLoginModal() {
            if (!loginModal) {
                return;
            }
            loginModal.classList.remove('active');
        }

        function renderAuth(session) {
            if (!navAuth) return;

            const user = session && session.user;
            if (user) {
                navAuth.innerHTML = `
                    <div class="user-info">
                        <span>${user.display_name || user.email}</span>
                        <button class="logout-btn" id="logout-btn">Выйти</button>
                    </div>
                `;

                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', event => {
                        event.preventDefault();
                        auth.logout();
                    });
                }
            } else {
                navAuth.innerHTML = '<button class="login-btn" id="login-btn">Войти / Регистрация</button>';
                const loginBtn = document.getElementById('login-btn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', event => {
                        event.preventDefault();
                        openLoginModal();
                    });
                }
            }
        }

        async function performLogin(event) {
            event.preventDefault();
            if (!loginForm) return;

            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const submitButton = loginForm.querySelector('button[type="submit"]');
            
            if (!emailInput || !passwordInput || !loginError) return;
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !password) {
                loginError.textContent = 'Пожалуйста, заполните все поля';
                loginError.style.display = 'block';
                return;
            }
            
            // Disable form and show loading
            submitButton.disabled = true;
            loginError.style.display = 'none';
            
            try {
                await auth.login(email, password);
                closeLoginModal();
            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = error.message || 'Не удалось войти. Проверьте введенные данные.';
                loginError.style.display = 'block';
            } finally {
                submitButton.disabled = false;
            }
        }
        
        async function performRegistration(event) {
            event.preventDefault();
            if (!registerForm) return;
            
            const emailInput = document.getElementById('register-email');
            const nameInput = document.getElementById('register-display-name');
            const passwordInput = document.getElementById('register-password');
            const confirmPasswordInput = document.getElementById('register-confirm-password');
            const submitButton = registerForm.querySelector('button[type="submit"]');
            
            if (!emailInput || !nameInput || !passwordInput || !confirmPasswordInput || !registerError) return;
            
            const email = emailInput.value.trim();
            const displayName = nameInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Basic validation
            if (!email || !displayName || !password || !confirmPassword) {
                registerError.textContent = 'Пожалуйста, заполните все поля';
                registerError.style.display = 'block';
                return;
            }
            
            if (password !== confirmPassword) {
                registerError.textContent = 'Пароли не совпадают';
                registerError.style.display = 'block';
                return;
            }
            
            if (password.length < 6) {
                registerError.textContent = 'Пароль должен содержать не менее 6 символов';
                registerError.style.display = 'block';
                return;
            }
            
            // Disable form and show loading
            submitButton.disabled = true;
            registerError.style.display = 'none';
            
            try {
                await auth.register(email, password, displayName);
                // After successful registration and auto-login, the auth change handler will close the modal
            } catch (error) {
                console.error('Registration error:', error);
                registerError.textContent = error.message || 'Не удалось зарегистрироваться. Пожалуйста, попробуйте снова.';
                registerError.style.display = 'block';
            } finally {
                submitButton.disabled = false;
            }
        }

        function displaySuggestions(results) {
            if (!searchSuggestions) {
                return;
            }

            searchSuggestions.innerHTML = '';

            if (!results.length) {
                searchSuggestions.classList.remove('active');
                return;
            }

            results.slice(0, 8).forEach((item) => {
                const button = document.createElement('button');
                button.className = 'suggestion';
                button.type = 'button';
                button.dataset.type = item.type;
                button.addEventListener('click', () => {
                    if (item.href) {
                        window.location.href = item.href;
                    }
                });

                const typeLabel = document.createElement('span');
                typeLabel.className = 'suggestion-type';
                typeLabel.textContent = TYPE_LABELS[item.type] || 'Инфо';

                const title = document.createElement('span');
                title.className = 'suggestion-title';
                title.textContent = item.title;

                const subtitle = document.createElement('span');
                subtitle.className = 'suggestion-subtitle';
                subtitle.textContent = item.subtitle || '';

                button.appendChild(typeLabel);
                button.appendChild(title);
                if (item.subtitle) {
                    button.appendChild(subtitle);
                }

                searchSuggestions.appendChild(button);
            });

            searchSuggestions.classList.add('active');
        }

        function flattenSearchResults(payload) {
            if (!payload || typeof payload !== 'object') {
                return [];
            }
            const buckets = ['cars', 'tracks', 'teams', 'champions', 'pilots'];
            const aggregated = [];
            buckets.forEach((key) => {
                const items = Array.isArray(payload[key]) ? payload[key] : [];
                items.forEach((item) => {
                    aggregated.push({
                        ...item,
                        type: item.type || key.slice(0, -1) || 'info',
                    });
                });
            });
            return aggregated;
        }

        async function performSearch(query) {
            if (!searchSuggestions) {
                return;
            }

            const trimmed = query.trim();
            if (!trimmed) {
                lastSearchResults = [];
                searchSuggestions.classList.remove('active');
                searchSuggestions.innerHTML = '';
                return;
            }

            const requestId = ++searchRequestId;
            try {
                const data = await api.get('search', { q: trimmed, limit: 5 }, { auth: false });
                if (requestId !== searchRequestId) {
                    return;
                }
                lastSearchResults = flattenSearchResults(data);
                displaySuggestions(lastSearchResults);
            } catch (error) {
                console.error('[index.js] Поиск не удался:', error);
                if (requestId === searchRequestId) {
                    lastSearchResults = [];
                    searchSuggestions.classList.remove('active');
                    searchSuggestions.innerHTML = '';
                }
            }
        }

        if (loginForm) {
            loginForm.addEventListener('submit', performLogin);
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', performRegistration);
        }
        
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                showRegisterForm();
            });
        }
        
        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                showLoginForm();
            });
        }
        
        if (loginClose) {
            loginClose.addEventListener('click', closeLoginModal);
        }

        if (loginModal) {
            loginModal.addEventListener('click', event => {
                if (event.target === loginModal) {
                    closeLoginModal();
                }
            });
        }

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && loginModal && loginModal.classList.contains('active')) {
                closeLoginModal();
            }
        });

        if (mainSearch) {
            mainSearch.addEventListener('input', event => {
                performSearch(event.target.value);
            });
            mainSearch.addEventListener('keypress', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (lastSearchResults.length) {
                        const target = lastSearchResults[0];
                        if (target.href) {
                            window.location.href = target.href;
                            return;
                        }
                    }
                    const query = mainSearch.value.trim();
                    if (query) {
                        window.location.href = `cars.html?search=${encodeURIComponent(query)}`;
                    }
                }
            });
            mainSearch.addEventListener('blur', () => {
                setTimeout(() => {
                    if (searchSuggestions) {
                        searchSuggestions.classList.remove('active');
                        searchSuggestions.innerHTML = '';
                    }
                }, 150);
            });
        }

        document.addEventListener('click', event => {
            if (!mainSearch || !searchSuggestions) {
                return;
            }
            if (!mainSearch.contains(event.target) && !searchSuggestions.contains(event.target)) {
                searchSuggestions.classList.remove('active');
            }
        });

        if (authUnsubscribe) {
            authUnsubscribe();
        }
        authUnsubscribe = auth.onChange((session) => {
            renderAuth(session);
        });

        if (mainSearch && mainSearch.value) {
            performSearch(mainSearch.value);
        }
    }
})();
