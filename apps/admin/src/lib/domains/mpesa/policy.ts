export function validatePayoutAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 150_000;
}
