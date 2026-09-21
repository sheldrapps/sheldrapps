import { routes } from './app.routes';
import { routes as tabRoutes } from './tabs/tabs.routes';

describe('app routes', () => {
  it('loads the tabs shell at the root route', () => {
    expect(routes[0].path).toBe('');
    expect(routes[0].loadChildren).toBeDefined();
  });

  it('exposes the remove ads purchase route', () => {
    const removeAdsRoute = routes.find(route => route.path === 'remove-ads');

    expect(removeAdsRoute?.data).toEqual({
      removeAdsVariant: 'ECC',
      removeAdsReturnUrl: '/tabs/edit',
    });
    expect(removeAdsRoute?.loadComponent).toBeDefined();
  });

  it('uses the edit page as the primary tab', () => {
    const tabsRoute = tabRoutes.find(route => route.path === 'tabs');
    const editRoute = tabsRoute?.children?.find(route => route.path === 'edit');

    expect(tabRoutes[0].redirectTo).toBe('/tabs/edit');
    expect(editRoute?.loadComponent).toBeDefined();
  });

  it('exposes the shared metadata editor route', () => {
    const metadataRoute = routes.find((route) => route.path === 'metadata-editor');

    expect(metadataRoute?.loadComponent).toBeDefined();
  });
});
