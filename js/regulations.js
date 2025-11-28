(function () {
    const regulationDetails = {
        technical: {
            title: 'Технический регламент GT3',
            sections: [
                {
                    title: 'Общие требования',
                    items: [
                        'Автомобиль должен быть серийной модели или основан на серийной модели',
                        'Общая масса машины не должна превышать 1300 кг (в зависимости от класса)',
                        'Использование современных аэродинамических элементов допускается только согласно утвержденным чертежам и ограничителям',
                        'Обязательное использование конструкционных компонентов с огнестойкими и ударопрочными характеристиками'
                    ]
                },
                {
                    title: 'Двигатель и трансмиссия',
                    items: [
                        'Объем двигателя ограничен серийными характеристиками (обычно 2.0–6.5 литров в зависимости от модели)',
                        'Допускается турбонаддув и компрессоры в рамках ограничений BOP (Balance of Performance)',
                        'Трансмиссия — только серийная или утвержденная гоночная коробка передач с секвентальным переключением',
                        'Привод на задние колеса или полный, в зависимости от модели; передний привод запрещен'
                    ]
                },
                {
                    title: 'Безопасность',
                    items: [
                        'Обязательная установка каркаса безопасности (roll cage) соответствующего стандарту FIA',
                        'Специальные гоночные сиденья и ремни безопасности 6 точек',
                        'Система пожаротушения, огнетушители и аварийное отключение электроники'
                    ]
                }
            ]
        },
        sport: {
            title: 'Спортивный регламент GT3',
            sections: [
                {
                    title: 'Форматы гонок',
                    items: [
                        'Соревнования проводятся на трассах, утвержденных FIA или организаторами серии',
                        'Продолжительность гонки: спринт — до 1 часа, гонки на выносливость — 2–24 часа',
                        'Допускается один или два пилота, в зависимости от формата гонки',
                        'Старт с места или по шеренге согласно регламенту старта'
                    ]
                },
                {
                    title: 'Правила проведения',
                    items: [
                        'Обязательное соблюдение правил пит-стопов, замены шин и дозаправки',
                        'Штрафы за несоблюдение BOP, столкновения, выход за пределы трассы и опасное вождение',
                        'Система квалификации и определения стартовой позиции'
                    ]
                }
            ]
        },
        general: {
            title: 'Общие правила серии GT3',
            sections: [
                {
                    title: 'Требования к участникам',
                    items: [
                        'Все автомобили должны проходить обязательный технический контроль перед гонкой',
                        'В случае изменения характеристик автомобиля требуется согласование с организаторами',
                        'Использование электроники и телеметрии регулируется BOP и спортивным регламентом'
                    ]
                },
                {
                    title: 'Оборудование и экипировка',
                    items: [
                        'Любые модификации двигателя, аэродинамики и шасси должны быть сертифицированы для GT3',
                        'Пилоты обязаны носить сертифицированные шлемы, комбинезоны, перчатки и обувь согласно FIA',
                        'Каждая команда должна иметь квалифицированный технический и медицинский персонал'
                    ]
                }
            ]
        }
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
    ]).then(initPage);

    function initPage() {
        const buttons = document.querySelectorAll('[data-reg-detail]');
        const modal = document.getElementById('detail-modal');
        const modalTitle = document.getElementById('detail-title');
        const modalContent = document.getElementById('detail-content');
        const modalClose = document.getElementById('detail-close');

        if (!buttons.length || !modal || !modalTitle || !modalContent || !modalClose) {
            return;
        }

        function populateModal(type) {
            const detail = regulationDetails[type];
            if (!detail) {
                return;
            }

            modalTitle.textContent = detail.title;
            modalContent.innerHTML = detail.sections.map(section => {
                const items = section.items.map(item => `<li>${item}</li>`).join('');
                return `<div class="detail-section"><h3>${section.title}</h3><ul>${items}</ul></div>`;
            }).join('');
        }

        function openModal(type) {
            populateModal(type);
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeModal() {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-reg-detail');
                openModal(type);
            });
        });

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
    }
})();
