interface UserProfile {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  userId: string;
  username: string;
  role: string;
}

interface UpdateProfilePayload {
  displayName?: string;
  phone?: string;
  bio?: string;
}

interface UpdateProfileResponse {
  message: string;
  user: UserProfile;
}

interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  phone?: string;
}