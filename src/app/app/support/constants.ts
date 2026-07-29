// Shared between the support page and its server action. It cannot live in
// the "use server" module: those may only export async functions.
export const CANCEL_REQUEST_MESSAGE = "Customer requested mandate cancellation";
