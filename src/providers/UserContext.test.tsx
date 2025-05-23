import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react'; // For React 18+ state updates
import { UserProvider, useUser, UserContextType } from './UserContext'; // Assuming test file is in the same dir or configured for this path
import '@testing-library/jest-dom'; // For additional matchers like .toBeInTheDocument()

// Store the original fetch implementation
const originalFetch = global.fetch;

// Global fetch mock setup
beforeEach(() => {
  global.fetch = jest.fn((url, options) => {
    // Default mock implementation: 
    // This can be overridden by specific tests using mockResolvedValueOnce or mockImplementationOnce.

    // Default behavior for /api/auth/me (called by checkAuthStatusAndFetchUser on mount)
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: false, // Simulate not authenticated by default
        status: 401,
        json: () => Promise.resolve({ error: 'Not authenticated by default in tests' }),
      } as Response); // Cast to Response type
    }

    // Default behavior for other unmocked API calls
    console.warn(`Unhandled API call in tests: ${options?.method || 'GET'} ${url}`);
    return Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Unhandled API call in tests' }),
    } as Response); // Cast to Response type
  }) as jest.Mock;
});

afterAll(() => {
  // Restore original fetch after all tests are done
  global.fetch = originalFetch;
});

describe('UserProvider', () => {
  // Helper component to consume the context for testing
  const TestConsumerComponent = () => {
    const context = useUser();
    if (!context) {
      return <div>No context</div>;
    }
    // Render some context values to check them
    return (
      <div>
        <div data-testid="isAuthenticated">{String(context.isAuthenticated)}</div>
        <div data-testid="user">{context.user ? context.user.username : 'null'}</div>
        <div data-testid="loading">{String(context.loading)}</div>
        <div data-testid="error">{context.error || 'null'}</div>
      </div>
    );
  };

  // Reset fetch mock's call history etc. before each test to ensure test isolation.
  // The implementation is already reset by the global beforeEach above.
  beforeEach(() => {
    if (global.fetch && typeof (global.fetch as jest.Mock).mockClear === 'function') {
        (global.fetch as jest.Mock).mockClear();
    }
  });

  it('should provide default values when rendered', async () => {
    render(
      <UserProvider>
        <TestConsumerComponent />
      </UserProvider>
    );

    // Example: Check for default initial state values
    // UserProvider calls checkAuthStatusAndFetchUser on mount, which involves fetch.
    // We need to wait for these state updates to settle.
    render(
      <UserProvider>
        <TestConsumerComponent />
      </UserProvider>
    );

    // Initially, loading is true because checkAuthStatusAndFetchUser starts immediately.
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    
    // Wait for the fetch mock for /api/auth/me to resolve and state updates to complete
    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false'); // Default mock is 401
    });
    
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('loading')).toHaveTextContent('false'); // Should be false after fetch
    // The default /api/auth/me mock returns a 401, which UserProvider treats as "not logged in"
    // and does not set an error message in the context for this specific case.
    expect(screen.getByTestId('error')).toHaveTextContent('null'); 
  });

  it('should have a basic placeholder test that passes', () => {
    expect(true).toBe(true);
  });

  // Enhanced TestConsumerComponent to expose context functions
  const InteractiveTestConsumerComponent = ({ testApi = {} }: { testApi?: any }) => {
    const context = useUser();
    if (!context) {
      return <div>No context</div>;
    }
    // Expose functions to testApi if provided
    testApi.login = context.login;
    testApi.logout = context.logout;
    testApi.signup = context.signup;
    testApi.checkAuthStatusAndFetchUser = context.checkAuthStatusAndFetchUser;

    return (
      <div>
        <div data-testid="isAuthenticated">{String(context.isAuthenticated)}</div>
        <div data-testid="user">{context.user ? context.user.username : 'null'}</div>
        <div data-testid="name">{context.user ? context.user.name : 'null'}</div>
        <div data-testid="email">{context.user ? context.user.email : 'null'}</div>
        <div data-testid="loading">{String(context.loading)}</div>
        <div data-testid="error">{context.error || 'null'}</div>
      </div>
    );
  };

  describe('checkAuthStatusAndFetchUser', () => {
    it('should fetch user and update context on successful load', async () => {
      const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', name: 'Test User' };
      (global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockUser),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({error: 'Not Found'})} as Response);
      });

      render(
        <UserProvider>
          <TestConsumerComponent />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      });
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });

    it('should handle API error on load', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce((url) => {
         if (url === '/api/auth/me') {
            return Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server Error' }),
            } as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({error: 'Not Found'})} as Response);
      });

      render(
        <UserProvider>
          <TestConsumerComponent />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Server Error');
      });
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    
    // The default 401 case is covered by 'should provide default values when rendered'
    // We can confirm it checks for no error message for 401.
    // The existing test 'should provide default values when rendered' already asserts error is 'null' for the default 401.
  });

  describe('login function', () => {
    const testApi: any = {};
    it('should login successfully and update context', async () => {
      const mockUser = { id: '2', username: 'loginuser', name: 'Login User', email: 'login@example.com' };
      (global.fetch as jest.Mock)
        .mockImplementationOnce((url) => { // For initial /api/auth/me
            return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Not authenticated' }) } as Response);
        })
        .mockImplementationOnce((url, options) => { // For /api/auth/login
          if (url === '/api/auth/login' && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(mockUser),
            } as Response);
          }
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled'}) } as Response);
        });

      render(
        <UserProvider>
          <InteractiveTestConsumerComponent testApi={testApi} />
        </UserProvider>
      );
      
      // Wait for initial auth check to complete
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

      await act(async () => {
        await testApi.login('loginuser', 'password');
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('loginuser');
      });
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'loginuser', password: 'password' }),
      }));
    });

    it('should handle failed login and set error', async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce((url) => { // For initial /api/auth/me
            return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Not authenticated' }) } as Response);
        })
        .mockImplementationOnce((url, options) => { // For /api/auth/login
          if (url === '/api/auth/login' && options?.method === 'POST') {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: () => Promise.resolve({ error: 'Invalid credentials' }),
            } as Response);
          }
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled'}) } as Response);
        });
      
      render(
        <UserProvider>
          <InteractiveTestConsumerComponent testApi={testApi} />
        </UserProvider>
      );
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));


      await act(async () => {
        await testApi.login('testuser', 'wrongpassword');
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      });
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', password: 'wrongpassword' }),
      }));
    });
  });

  describe('signup function', () => {
    const testApi: any = {};
    it('should signup successfully and update context', async () => {
      const mockUser = { id: '3', username: 'newuser', name: 'New User', email: 'new@example.com' };
      (global.fetch as jest.Mock)
        .mockImplementationOnce((url) => { // For initial /api/auth/me
            return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Not authenticated' }) } as Response);
        })
        .mockImplementationOnce((url, options) => { // For /api/auth/signup
          if (url === '/api/auth/signup' && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve(mockUser),
            } as Response);
          }
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled'}) } as Response);
        });
      
      render(
        <UserProvider>
          <InteractiveTestConsumerComponent testApi={testApi} />
        </UserProvider>
      );
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

      await act(async () => {
        await testApi.signup('newuser', 'new@example.com', 'password');
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('newuser');
      });
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'newuser', email: 'new@example.com', password: 'password' }),
      }));
    });

    it('should handle failed signup and set error', async () => {
       (global.fetch as jest.Mock)
        .mockImplementationOnce((url) => { // For initial /api/auth/me
            return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Not authenticated' }) } as Response);
        })
        .mockImplementationOnce((url, options) => { // For /api/auth/signup
          if (url === '/api/auth/signup' && options?.method === 'POST') {
            return Promise.resolve({
              ok: false,
              status: 409, // Conflict
              json: () => Promise.resolve({ message: 'User already exists' }), // API returns 'message'
            } as Response);
          }
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled'}) } as Response);
        });

      render(
        <UserProvider>
          <InteractiveTestConsumerComponent testApi={testApi} />
        </UserProvider>
      );
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

      await act(async () => {
        await testApi.signup('testuser', 'test@example.com', 'password');
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('User already exists');
      });
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', email: 'test@example.com', password: 'password' }),
      }));
    });
  });
  
  describe('logout function', () => {
    const testApi: any = {};
    it('should logout successfully and clear context', async () => {
      const loginUser = { id: '4', username: 'logouttest', name: 'Logout Test', email: 'logout@example.com' };
      // Step 1: Simulate initial unauthenticated state for /api/auth/me
      (global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Not authenticated' }) } as Response);
        }
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled /api/auth/me'}) } as Response);
      });
      
      render(
        <UserProvider>
          <InteractiveTestConsumerComponent testApi={testApi} />
        </UserProvider>
      );
      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false')); // Initial load done

      // Step 2: Simulate successful login
      (global.fetch as jest.Mock).mockImplementationOnce((url, options) => {
        if (url === '/api/auth/login' && options?.method === 'POST') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(loginUser) } as Response);
        }
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled /api/auth/login'}) } as Response);
      });

      await act(async () => {
        await testApi.login('logouttest', 'password');
      });
      await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true'));
      expect(screen.getByTestId('user')).toHaveTextContent('logouttest');

      // Step 3: Mock /api/auth/logout for successful logout
      (global.fetch as jest.Mock).mockImplementationOnce((url, options) => {
        if (url === '/api/auth/logout' && options?.method === 'POST') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'Logged out' }) } as Response);
        }
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({error: 'Unhandled /api/auth/logout'}) } as Response);
      });

      await act(async () => {
        await testApi.logout();
      });

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      });
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    });
  });
});

// Note: If a testing setup like Jest is not already present in the project,
// it would need to be configured. This file assumes such an environment.
// This includes installing Jest, React Testing Library, jest-dom, and ts-jest (for TypeScript).
// A jest.config.js or similar configuration file would also be needed.
