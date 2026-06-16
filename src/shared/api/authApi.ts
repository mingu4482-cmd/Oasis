import { apiClient } from './client';
import { RegisteredUser, UserRole } from '../types/domain';

export interface SignupPayload {
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  password: string;
  organization: string;
  department: string;
  address: string;
  emergencyContact: string;
  memo: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  user: RegisteredUser;
}

export async function signup(payload: SignupPayload) {
  const response = await apiClient.post<AuthResponse>('/auth/signup', payload);
  return response.data.user;
}

export async function login(payload: LoginPayload) {
  const response = await apiClient.post<AuthResponse>('/auth/login', payload);
  return response.data.user;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}
