import createCrudRouter from './crudFactory.js';

export default createCrudRouter({
    table: 'teams',
    fields: [
        ['name', 'text'],
        ['country', 'text'],
        ['founded', 'int'],
        ['series', 'text'],
        ['cars', 'text'],
        ['logo', 'text'],
        ['image_url', 'text'],
        ['description', 'text'],
        ['stats', 'text'],
        ['achievements', 'text'],
    ],
    jsonFields: ['series', 'cars', 'stats', 'achievements'],
    searchColumns: ['name', 'country', 'series'],
    defaultOrder: 'name COLLATE NOCASE ASC',
});
