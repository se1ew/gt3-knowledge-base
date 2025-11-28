import createCrudRouter from './crudFactory.js';

export default createCrudRouter({
    table: 'tracks',
    fields: [
        ['name', 'text'],
        ['country', 'text'],
        ['length_km', 'float'],
        ['type', 'text'],
        ['location', 'text'],
        ['turns', 'int'],
        ['established', 'int'],
        ['image_url', 'text'],
        ['card_image_url', 'text'],
        ['detail_image_url', 'text'],
        ['description', 'text'],
    ],
    searchColumns: ['name', 'country', 'location'],
    defaultOrder: 'name COLLATE NOCASE ASC',
});
