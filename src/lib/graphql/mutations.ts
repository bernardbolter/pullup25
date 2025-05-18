export const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      authToken
      user {
        id
        name
        email
      }
    }
  }
`;

export const REGISTER_MUTATION = `
  mutation RegisterUser($input: RegisterUserInput!) {
    registerUser(input: $input) {
      user {
        id
        name
        email
      }
    }
  }
`; 