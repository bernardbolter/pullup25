export interface User {
    id: number;
    username: string;
    name: string;
    email: string;
    token: string;
  }
  
  export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
  }