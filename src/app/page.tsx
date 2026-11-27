import TripGenieStudio from "@/components/TripGenieStudio";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialUser = await getAuthenticatedUser();
  return <TripGenieStudio initialUser={initialUser} />;
}
