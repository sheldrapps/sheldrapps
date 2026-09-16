import { routes } from './app.routes';

describe('app routes', () => {
  it('loads the tabs shell at the root route', () => {
    expect(routes[0].path).toBe('');
    expect(routes[0].loadChildren).toBeDefined();
  });
});
