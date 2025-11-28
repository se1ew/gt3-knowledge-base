import createCrudRouter from './crudFactory.js';

export default createCrudRouter({
    table: 'cars',
    fields: [
        ['brand', 'text'],
        ['model', 'text'],
        ['generation', 'text'],
        ['year', 'int'],
        ['engine', 'text'],
        ['power', 'int'],
        ['torque', 'int'],
        ['weight', 'int'],
        ['top_speed', 'int'],
        ['image_url', 'text'],
        ['description', 'text'],
    ],
    searchColumns: ['brand', 'model', 'engine', 'generation'],
    defaultOrder: 'updated_at DESC',
});
