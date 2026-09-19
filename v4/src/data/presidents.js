import raw from './presidents.json';

// Sorted once, mirrors PresidentsRepository.loadAll() sorting by `order`.
const presidents = [...raw].sort((a, b) => a.order - b.order);

export default presidents;
