import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

/**
 * Public QR deep link. A signed-in retailer goes straight to the redeem flow
 * with the token pre-filled; anyone else goes through login and lands back
 * here, which then forwards to redeem. Unknown or invalid tokens are handled
 * by the redeem screen itself, with a designed error state.
 */
export default async function DeepLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getSessionUser();
  if (user?.role === "retailer") {
    redirect(`/retailer/redeem?token=${encodeURIComponent(token)}`);
  }
  redirect(`/login?next=${encodeURIComponent(`/r/${token}`)}`);
}
