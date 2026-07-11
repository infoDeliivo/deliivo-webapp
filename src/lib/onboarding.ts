import type { UserProfile } from './api';

type OnboardingProfile = Pick<UserProfile, 'onboardingStatus' | 'name' | 'salutation' | 'gender' | 'dob'>;

export function isOnboardingComplete(user: OnboardingProfile | null | undefined) {
  return Boolean(
    user &&
      user.onboardingStatus === 'COMPLETED' &&
      user.name?.trim() &&
      user.salutation &&
      user.gender &&
      user.dob,
  );
}
