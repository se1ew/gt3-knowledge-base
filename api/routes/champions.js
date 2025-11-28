import createCrudRouter from './crudFactory.js';

export default createCrudRouter({
    table: 'champions',
    fields: [
        ['year', 'int'],
        ['series', 'text'],
        ['team_name', 'text'],
        ['drivers', 'text'],
        ['car', 'text'],
        ['image_url', 'text'],
        ['stats', 'text'],
        ['description', 'text'],
    ],
    jsonFields: ['drivers', 'stats'],
    searchColumns: ['team_name', 'series', 'car'],
    defaultOrder: 'year DESC, team_name COLLATE NOCASE ASC',
});
