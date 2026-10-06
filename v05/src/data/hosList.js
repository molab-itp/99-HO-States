import raw from './hos.json';

// Sorted once, mirrors HOSRepository.loadAll() sorting by `order`.
const hosList = [...raw].sort((a, b) => a.order - b.order);

export default hosList;
