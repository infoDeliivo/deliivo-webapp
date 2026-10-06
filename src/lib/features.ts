export const featureFlags = {
  rewards: process.env.NEXT_PUBLIC_REWARDS_ENABLED === 'true',
  webChat: process.env.NEXT_PUBLIC_ENABLE_WEB_CHAT !== 'false',
  emailPhoneAuth: process.env.NEXT_PUBLIC_ENABLE_EMAIL_PHONE_AUTH === 'true',
};
