import type { UserProfile } from './api';

type OnboardingProfile = Pick<UserProfile, 'onboardingStatus' | 'firstName' | 'lastName' | 'salutation' | 'gender' | 'dob'>;

export function isOnboardingComplete(user: OnboardingProfile | null | undefined) {
  return Boolean(
    user &&
      user.onboardingStatus === 'COMPLETED' &&
      user.firstName?.trim() &&
      user.lastName?.trim() &&
      user.salutation &&
      user.gender &&
      user.dob,
  );
}
