type Translate = (key: string) => string;

const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING: 'rides.pending',
  PAYMENT_PENDING: 'rides.paymentPending',
  DRIVER_PENDING: 'rides.driverPending',
  ACCEPTED: 'rides.accepted',
  CONFIRMED: 'rides.confirmed',
  PUBLISHED: 'rides.upcoming',
  SCHEDULED: 'rides.upcoming',
  READY_TO_START: 'rides.readyToStart',
  WAITING_FOR_PICKUP: 'rides.waitingForPickup',
  DRIVER_ARRIVED: 'rides.driverArrived',
  OTP_PENDING: 'rides.otpPending',
  IN_PROGRESS: 'rides.inProgress',
  ONBOARD: 'rides.onboard',
  DROP_PENDING: 'rides.dropoffPending',
  DRIVER_DROPPED: 'rides.driverDropped',
  COMPLETION_PENDING: 'rides.completionPending',
  COMPLETED: 'rides.completed',
  PAYMENT_FAILED: 'rides.paymentFailed',
  CANCELLED: 'rides.cancelled',
  NO_SHOW: 'rides.noShow',
  DRIVER_MISSED_PICKUP: 'rides.missedPickup',
  DISPUTED: 'rides.disputed',
  WITHDRAWN: 'rides.withdrawn',
  REJECTED: 'rides.rejected',
  EXPIRED: 'rides.expired',
};

export function getRideStatusLabel(status: string, t: Translate) {
  const key = STATUS_LABEL_KEYS[status];
  if (key) return t(key);

  return status
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getBookingStatusBadgeClass(status: string) {
  if (['COMPLETED'].includes(status)) return 'bg-green-50 text-green-700 border border-green-200';
  if (['NO_SHOW', 'DRIVER_MISSED_PICKUP', 'PAYMENT_FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(status)) {
    return 'bg-red-50 text-red-700 border border-red-200';
  }
  if (status === 'DISPUTED') return 'bg-purple-50 text-purple-700 border border-purple-200';
  if (['ACCEPTED', 'CONFIRMED', 'WAITING_FOR_PICKUP', 'DRIVER_ARRIVED', 'OTP_PENDING', 'IN_PROGRESS', 'ONBOARD', 'DROP_PENDING', 'DRIVER_DROPPED'].includes(status)) {
    return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  }
  return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
}
