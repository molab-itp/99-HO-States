import raw from './links.json';

// This app's own address: v2's "Web App" entry would only link back here, so it is left out.
const WEB_APP_URL = 'https://molab-itp.github.io/99-HO-States/v05/';

// Mirrors LinksRepository.loadAll(): the external links shown in Settings, in links.json order.
const links = raw.filter((link) => link.url !== WEB_APP_URL);

export default links;
