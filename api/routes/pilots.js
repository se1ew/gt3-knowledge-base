import createCrudRouter from './crudFactory.js';

export default createCrudRouter({
    table: 'pilots',
    fields: [
        ['name', 'text'],
        ['nationality', 'text'],
        ['flag', 'text'],
        ['team', 'text'],
        ['car', 'text'],
        ['championships', 'text'],
        ['stats', 'text'],
        ['series', 'text'],
        ['tags', 'text'],
        ['image_url', 'text'],
    ],
    jsonFields: ['championships', 'stats', 'series', 'tags'],
    searchColumns: ['name', 'team', 'series'],
    defaultOrder: 'name COLLATE NOCASE ASC',
});
