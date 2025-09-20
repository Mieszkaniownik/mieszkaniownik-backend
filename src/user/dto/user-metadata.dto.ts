import { Role } from '@prisma/client';

export interface UserMetadata {
  email: string;
  name: string | null;
  surname: string | null;
  role: Role;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
